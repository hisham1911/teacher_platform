using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Infrastructure.Services;
using AppSessionOptions = TeacherPlatform.Application.Options.SessionOptions;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// دخول الطالب المُدار إلى جلسة نشاط. يتحقق من StudentCode داخل Tenant الجلسة ثم يصدر نفس كوكي اللاعب المستخدم في بقية Player API.
/// </summary>
[ApiController]
[Route("api/v1/player/sessions")]
[Produces("application/json")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class ManagedStudentJoinController : ControllerBase
{
    private readonly ManagedStudentJoinService _joinService;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IOptions<AppSessionOptions> _sessionOptions;

    public ManagedStudentJoinController(
        ManagedStudentJoinService joinService,
        IOptions<AuthOptions> authOptions,
        IOptions<AppSessionOptions> sessionOptions)
    {
        _joinService = joinService;
        _authOptions = authOptions;
        _sessionOptions = sessionOptions;
    }

    [HttpPost("{joinCode}/student-join")]
    [ProducesResponseType(typeof(JoinSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Join(
        [FromRoute] string joinCode,
        [FromBody] StudentCodeJoinRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var result = await _joinService.JoinAsync(joinCode, request.StudentCode, cancellationToken);
        SetGuestCookie(result.RawGuestToken);
        return Ok(result.Player);
    }

    private void SetGuestCookie(string rawToken)
    {
        var options = _authOptions.Value;
        Response.Cookies.Append(GuestTokenService.ResolveCookieName(options.UseSecureCookie), rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = ResolveSameSite(options),
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(_sessionOptions.Value.GuestTokenDays),
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
