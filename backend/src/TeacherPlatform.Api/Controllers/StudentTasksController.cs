using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Assignments;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Infrastructure.Services;
using AppSessionOptions = TeacherPlatform.Application.Options.SessionOptions;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/student-portal/tasks")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class StudentTasksController : ControllerBase
{
    private readonly AssignmentService _assignments;
    private readonly StudentPortalService _portal;
    private readonly IOptions<StudentPortalOptions> _portalOptions;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IOptions<AppSessionOptions> _sessionOptions;

    public StudentTasksController(AssignmentService assignments, StudentPortalService portal, IOptions<StudentPortalOptions> portalOptions, IOptions<AuthOptions> authOptions, IOptions<AppSessionOptions> sessionOptions)
    {
        _assignments = assignments;
        _portal = portal;
        _portalOptions = portalOptions;
        _authOptions = authOptions;
        _sessionOptions = sessionOptions;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var identity = await ResolveIdentityAsync(cancellationToken);
        return Ok(await _assignments.ListForStudentAsync(identity, cancellationToken));
    }

    [HttpPost("{assignmentId:guid}/start")]
    [EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
    public async Task<IActionResult> Start([FromRoute] Guid assignmentId, CancellationToken cancellationToken)
    {
        var identity = await ResolveIdentityAsync(cancellationToken);
        var result = await _assignments.StartForStudentAsync(assignmentId, identity, cancellationToken);
        SetGuestCookie(result.RawGuestToken);
        return Ok(result.Response);
    }

    private async Task<Application.Students.StudentPortalIdentity> ResolveIdentityAsync(CancellationToken cancellationToken)
    {
        var token = Request.Cookies[StudentPortalTokenService.ResolveCookieName(_portalOptions.Value.CookieName, _authOptions.Value.UseSecureCookie)];
        if (string.IsNullOrWhiteSpace(token)) throw new ServiceResultException("Unauthorized", "Student portal session is required.");
        return await _portal.ResolveIdentityAsync(token, cancellationToken);
    }

    private void SetGuestCookie(string rawToken)
    {
        var options = _authOptions.Value;
        Response.Cookies.Append(GuestTokenService.ResolveCookieName(options.UseSecureCookie), rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = options.CookieSameSite switch { "Lax" => SameSiteMode.Lax, "None" => SameSiteMode.None, _ => SameSiteMode.Strict },
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(_sessionOptions.Value.GuestTokenDays),
            IsEssential = true
        });
    }
}
