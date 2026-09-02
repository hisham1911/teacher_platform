using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/student-portal")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class StudentPortalController : ControllerBase
{
    private readonly StudentPortalService _portalService;
    private readonly IOptions<StudentPortalOptions> _portalOptions;
    private readonly IOptions<AuthOptions> _authOptions;

    public StudentPortalController(
        StudentPortalService portalService,
        IOptions<StudentPortalOptions> portalOptions,
        IOptions<AuthOptions> authOptions)
    {
        _portalService = portalService;
        _portalOptions = portalOptions;
        _authOptions = authOptions;
    }

    [HttpGet("status")]
    [ProducesResponseType(typeof(StudentPortalAvailabilityResponse), StatusCodes.Status200OK)]
    public IActionResult Status()
    {
        return Ok(new StudentPortalAvailabilityResponse
        {
            Enabled = _portalOptions.Value.Enabled
        });
    }

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(StudentPortalProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login([FromBody] StudentPortalLoginRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _portalService.LoginAsync(request.AccessCode, cancellationToken);
        SetPortalCookie(result.RawSessionToken, result.ExpiresAt);
        return Ok(result.Profile);
    }

    [HttpGet("me")]
    [ProducesResponseType(typeof(StudentPortalProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var token = ReadPortalCookie();
        if (string.IsNullOrWhiteSpace(token)) return Unauthorized();
        return Ok(await _portalService.GetProfileAsync(token, cancellationToken));
    }

    [HttpGet("home")]
    [ProducesResponseType(typeof(StudentPortalHomeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Home(CancellationToken cancellationToken)
    {
        var token = ReadPortalCookie();
        if (string.IsNullOrWhiteSpace(token)) return Unauthorized();
        return Ok(await _portalService.GetHomeAsync(token, cancellationToken));
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var token = ReadPortalCookie();
        await _portalService.LogoutAsync(token, cancellationToken);
        DeletePortalCookie();
        return NoContent();
    }

    private string? ReadPortalCookie() =>
        Request.Cookies[StudentPortalTokenService.ResolveCookieName(_portalOptions.Value.CookieName, _authOptions.Value.UseSecureCookie)];

    private void SetPortalCookie(string rawToken, DateTime expiresAt)
    {
        var auth = _authOptions.Value;
        Response.Cookies.Append(
            StudentPortalTokenService.ResolveCookieName(_portalOptions.Value.CookieName, auth.UseSecureCookie),
            rawToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = auth.UseSecureCookie,
                SameSite = ResolveSameSite(auth),
                Path = "/",
                Expires = new DateTimeOffset(expiresAt, TimeSpan.Zero),
                IsEssential = true
            });
    }

    private void DeletePortalCookie()
    {
        var auth = _authOptions.Value;
        Response.Cookies.Delete(
            StudentPortalTokenService.ResolveCookieName(_portalOptions.Value.CookieName, auth.UseSecureCookie),
            new CookieOptions
            {
                HttpOnly = true,
                Secure = auth.UseSecureCookie,
                SameSite = ResolveSameSite(auth),
                Path = "/",
                IsEssential = true
            });
    }

    private static SameSiteMode ResolveSameSite(AuthOptions options) => options.CookieSameSite switch
    {
        "Lax" => SameSiteMode.Lax,
        "None" => SameSiteMode.None,
        _ => SameSiteMode.Strict
    };
}
