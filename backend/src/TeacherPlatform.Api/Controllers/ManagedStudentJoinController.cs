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
/// ربط الطالب المُدار بجلسة نشاط. StudentCode القديم يبقى للتوافق،
/// بينما portal-join يستخدم هوية بوابة الطالب من HttpOnly cookie بدون إعادة إدخال أي كود.
/// </summary>
[ApiController]
[Route("api/v1/player/sessions")]
[Produces("application/json")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class ManagedStudentJoinController : ControllerBase
{
    private readonly ManagedStudentJoinService _joinService;
    private readonly StudentPortalService _portalService;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IOptions<AppSessionOptions> _sessionOptions;
    private readonly IOptions<StudentPortalOptions> _portalOptions;

    public ManagedStudentJoinController(
        ManagedStudentJoinService joinService,
        StudentPortalService portalService,
        IOptions<AuthOptions> authOptions,
        IOptions<AppSessionOptions> sessionOptions,
        IOptions<StudentPortalOptions> portalOptions)
    {
        _joinService = joinService;
        _portalService = portalService;
        _authOptions = authOptions;
        _sessionOptions = sessionOptions;
        _portalOptions = portalOptions;
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

    [HttpPost("{joinCode}/portal-join")]
    [ProducesResponseType(typeof(JoinSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> PortalJoin([FromRoute] string joinCode, CancellationToken cancellationToken)
    {
        var portalToken = ReadPortalCookie();
        if (string.IsNullOrWhiteSpace(portalToken)) return Unauthorized();

        var identity = await _portalService.ResolveIdentityAsync(portalToken, cancellationToken);
        var result = await _joinService.JoinPortalAsync(joinCode, identity, cancellationToken);
        SetGuestCookie(result.RawGuestToken);
        return Ok(result.Player);
    }

    private string? ReadPortalCookie() =>
        Request.Cookies[StudentPortalTokenService.ResolveCookieName(_portalOptions.Value.CookieName, _authOptions.Value.UseSecureCookie)];

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
