using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Auth;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly RefreshTokenService _refreshTokenService;
    private readonly JwtTokenGenerator _jwtTokenGenerator;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly AppDbContext _db;
    private readonly TenantBypassService _bypass;
    private readonly Microsoft.AspNetCore.Identity.SignInManager<ApplicationUser> _signInManager;

    public AuthController(
        AuthService authService,
        RefreshTokenService refreshTokenService,
        JwtTokenGenerator jwtTokenGenerator,
        IOptions<AuthOptions> authOptions,
        AppDbContext db,
        TenantBypassService bypass,
        Microsoft.AspNetCore.Identity.SignInManager<ApplicationUser> signInManager)
    {
        _authService = authService;
        _refreshTokenService = refreshTokenService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _authOptions = authOptions;
        _db = db;
        _bypass = bypass;
        _signInManager = signInManager;
    }

    /// <summary>تسجيل مستخدم جديد — لا يقبل Role أو PlatformRole. لا يعيد Tokens أو بيانات سرية.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, _) = await _authService.RegisterAsync(request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        // لا نعيد tenant أو tokens أو حالة البريد — رسالة عامة موحّدة
        return Ok(new MessageResponse
        {
            Message = "Registration received. Check your email to confirm your account."
        });
    }

    /// <summary>تأكيد البريد — عبر uid وtoken من رابط البريد.</summary>
    [HttpPost("confirm-email")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var error = await _authService.ConfirmEmailAsync(request.Uid, request.Token);
        if (error is not null)
        {
            throw error;
        }

        return Ok(new MessageResponse { Message = "Email confirmed successfully." });
    }

    /// <summary>تسجيل الدخول — يعيد Access Token ويدبّس Refresh Cookie HttpOnly. لا يعيد Refresh في JSON.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, user) = await _authService.LoginAsync(request);
        if (error is not null || user is null)
        {
            if (error is not null)
            {
                throw error;
            }
            return Unauthorized();
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var authOptions = _authOptions.Value;
        var refresh = await _refreshTokenService.IssueAsync(
            user.Id,
            authOptions.RefreshTokenDays,
            ip,
            userAgent,
            cancellationToken);

        SetRefreshCookie(refresh.RawToken, refresh.ExpiresAt, authOptions);

        var platformRoles = await _signInManager.UserManager.GetRolesAsync(user);
        var access = _jwtTokenGenerator.Generate(user, platformRoles);

        var profile = await _db.UserProfiles.SingleAsync(p => p.UserId == user.Id, cancellationToken);
        var response = new SessionResponse
        {
            AccessToken = access.Token,
            AccessTokenExpiresAt = access.ExpiresAt,
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                FullName = profile.FullName,
                EmailConfirmed = user.EmailConfirmed
            }
            // ActiveWorkspace تُحسم في الواجهة من /tenants/mine
        };

        return Ok(response);
    }

    /// <summary>تدوير الجلسة — يستبدل Cookie القديمة بجديدة ويعيد Access Token جديدًا.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        var authOptions = _authOptions.Value;

        if (!Request.Cookies.TryGetValue(RefreshTokenService.CookieName, out var rawToken) || string.IsNullOrEmpty(rawToken))
        {
            return Unauthorized(new { title = "Unauthorized", status = 401 });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var (result, userId, newToken) = await _refreshTokenService.RotateAsync(
            rawToken,
            authOptions.RefreshTokenDays,
            ip,
            userAgent,
            cancellationToken);

        if (result != RefreshRotationResult.Rotated || userId is null || newToken is null)
        {
            // كشف Reuse أو Invalid — امسح الكوكي ولا تكشف التفاصيل
            ClearRefreshCookie(authOptions);
            return Unauthorized(new { title = "Unauthorized", status = 401 });
        }

        SetRefreshCookie(newToken.RawToken, newToken.ExpiresAt, authOptions);

        var user = await _db.Users.SingleAsync(u => u.Id == userId.Value, cancellationToken);
        var platformRoles = await _signInManager.UserManager.GetRolesAsync(user);
        var access = _jwtTokenGenerator.Generate(user, platformRoles);

        var profile = await _db.UserProfiles.SingleAsync(p => p.UserId == user.Id, cancellationToken);
        var response = new SessionResponse
        {
            AccessToken = access.Token,
            AccessTokenExpiresAt = access.ExpiresAt,
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                FullName = profile.FullName,
                EmailConfirmed = user.EmailConfirmed
            }
        };

        return Ok(response);
    }

    /// <summary>تسجيل الخروج — يُلغي الرمز الحالي ويحذف الكوكي بأمان قابل للتكرار.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var authOptions = _authOptions.Value;

        if (Request.Cookies.TryGetValue(RefreshTokenService.CookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken))
        {
            await _refreshTokenService.RevokeAsync(rawToken, RefreshTokenRevocationReasons.Logout, cancellationToken);
        }

        ClearRefreshCookie(authOptions);
        return Ok(new MessageResponse { Message = "Logged out." });
    }

    /// <summary>طلب إعادة تعيين كلمة المرور — دائمًا Response عام سواء وُجد البريد أم لا.</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status202Accepted)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        await _authService.ForgotPasswordAsync(request, cancellationToken);
        return Accepted(new MessageResponse
        {
            Message = "If the address exists, you will receive an email with password reset instructions."
        });
    }

    /// <summary>إعادة تعيين كلمة المرور — تلغي رموز التحديث القديمة وتحدّث Security Stamp.</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, userId) = await _authService.ResetPasswordAsync(request);
        if (error is not null || userId is null)
        {
            throw error ?? new InvalidOperationException("Reset failed.");
        }

        await _refreshTokenService.RevokeAllActiveForUserAsync(
            userId.Value,
            RefreshTokenRevocationReasons.PasswordReset,
            cancellationToken);

        return Ok(new MessageResponse { Message = "Password has been reset." });
    }

    /// <summary>معلومات المستخدم الحالي — ببيانات السياق المختار (إن وُجد).</summary>
    [HttpGet("me")]
    [Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(sub, out var userId))
        {
            return Unauthorized();
        }

        var user = await _db.Users.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var profile = await _db.UserProfiles.SingleOrDefaultAsync(p => p.UserId == userId, cancellationToken);

        WorkspaceDto? activeWorkspace = null;
        if (HttpContext.Items.TryGetValue(Middleware.TenantResolutionMiddleware.TenantIdItemKey, out var tenantIdObj)
            && tenantIdObj is Guid tenantId)
        {
            var membership = await _bypass.FindMembershipIncludeTenantIgnoreFiltersAsync(tenantId, userId, cancellationToken);
            if (membership is not null)
            {
                activeWorkspace = new WorkspaceDto
                {
                    Id = membership.Tenant!.Id,
                    Name = membership.Tenant.Name,
                    Slug = membership.Tenant.Slug,
                    Role = membership.Role.ToString(),
                    Status = membership.Tenant.Status.ToString()
                };
            }
        }

        var response = new SessionResponse
        {
            AccessToken = string.Empty,
            AccessTokenExpiresAt = default,
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                FullName = profile?.FullName ?? string.Empty,
                EmailConfirmed = user.EmailConfirmed
            },
            ActiveWorkspace = activeWorkspace
        };

        return Ok(response);
    }

    private void SetRefreshCookie(string rawToken, DateTime expiresAt, AuthOptions options)
    {
        var sameSite = options.CookieSameSite switch
        {
            "Lax" => SameSiteMode.Lax,
            "None" => SameSiteMode.None,
            _ => SameSiteMode.Strict
        };

        Response.Cookies.Append(RefreshTokenService.CookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = sameSite,
            Path = "/api/v1/auth", // Host-only قدر الإمكان: لا Domain
            Expires = expiresAt,
            IsEssential = true
        });
    }

    private void ClearRefreshCookie(AuthOptions options)
    {
        var sameSite = options.CookieSameSite switch
        {
            "Lax" => SameSiteMode.Lax,
            "None" => SameSiteMode.None,
            _ => SameSiteMode.Strict
        };

        Response.Cookies.Delete(RefreshTokenService.CookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = sameSite,
            Path = "/api/v1/auth"
        });
    }
}
