using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/player/sessions")]
[Produces("application/json")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class PlayerLiveController : ControllerBase
{
    private readonly PlayerAttemptAccessService _access;
    private readonly LiveSessionService _liveSessions;
    private readonly LiveTokenService _liveTokens;
    private readonly IOptions<AuthOptions> _authOptions;

    public PlayerLiveController(
        PlayerAttemptAccessService access,
        LiveSessionService liveSessions,
        LiveTokenService liveTokens,
        IOptions<AuthOptions> authOptions)
    {
        _access = access;
        _liveSessions = liveSessions;
        _liveTokens = liveTokens;
        _authOptions = authOptions;
    }

    [HttpGet("{joinCode}/live")]
    [ProducesResponseType(typeof(LiveSessionStateResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetState(string joinCode, CancellationToken cancellationToken)
    {
        var access = await RequireAccessAsync(joinCode, cancellationToken);
        var state = await _liveSessions.GetForConnectionAsync(
            access.Session.TenantId,
            access.Session.Id,
            cancellationToken);
        return state is null
            ? throw new ServiceResultException("NotFound", "Live session not found.")
            : Ok(state);
    }

    [HttpPost("{joinCode}/live/token")]
    [ProducesResponseType(typeof(LiveTokenResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Token(string joinCode, CancellationToken cancellationToken)
    {
        var access = await RequireAccessAsync(joinCode, cancellationToken);
        if (access.Session.Status != SessionStatus.Active)
        {
            throw new ServiceResultException("Conflict", "Live session is not active.");
        }
        return Ok(_liveTokens.GeneratePlayer(
            access.Participant.Id,
            access.Session.TenantId,
            access.Session.Id));
    }

    private async Task<PlayerSessionAccess> RequireAccessAsync(
        string joinCode,
        CancellationToken cancellationToken)
    {
        var rawToken = ReadGuestToken()
            ?? throw new ServiceResultException("Unauthorized", "Guest token cookie is missing.");
        var (error, access) = await _access.ResolveSessionAsync(joinCode, rawToken, cancellationToken);
        if (error is not null) throw error;
        if (access!.Session.Mode != SessionMode.Live)
        {
            throw new ServiceResultException("NotFound", "Live session not found.");
        }
        return access;
    }

    private string? ReadGuestToken()
    {
        var name = GuestTokenService.ResolveCookieName(_authOptions.Value.UseSecureCookie);
        return Request.Cookies.TryGetValue(name, out var rawToken) && !string.IsNullOrEmpty(rawToken)
            ? rawToken
            : null;
    }
}
