using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Api.Hubs;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/quizzes/{quizId:guid}/sessions/{sessionId:guid}/live")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
public sealed class LiveSessionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LiveSessionService _liveSessions;
    private readonly LiveTokenService _liveTokens;
    private readonly IHubContext<QuizHub> _hub;

    public LiveSessionsController(
        AppDbContext db,
        LiveSessionService liveSessions,
        LiveTokenService liveTokens,
        IHubContext<QuizHub> hub)
    {
        _db = db;
        _liveSessions = liveSessions;
        _liveTokens = liveTokens;
        _hub = hub;
    }

    [HttpGet]
    [ProducesResponseType(typeof(LiveSessionStateResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        Guid tenantId,
        Guid quizId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        await EnsureRouteAsync(quizId, sessionId, cancellationToken);
        return Ok(await RequireStateAsync(sessionId, cancellationToken));
    }

    [HttpPost("token")]
    [ProducesResponseType(typeof(LiveTokenResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Token(
        Guid tenantId,
        Guid quizId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        await EnsureRouteAsync(quizId, sessionId, cancellationToken);
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            throw new ServiceResultException("Unauthorized", "User identity is invalid.");
        }
        return Ok(_liveTokens.GenerateTeacher(userId, tenantId, sessionId));
    }

    [HttpPost("questions/open-next")]
    public async Task<IActionResult> OpenNext(
        Guid tenantId,
        Guid quizId,
        Guid sessionId,
        [FromBody] LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureRouteAsync(quizId, sessionId, cancellationToken);
        var (error, state) = await _liveSessions.OpenNextAsync(sessionId, request, cancellationToken);
        if (error is not null) throw error;

        if (state!.CurrentQuestionIndex == 0)
        {
            await PublishAllAsync(tenantId, sessionId, LiveEventNames.SessionStarted, state, cancellationToken);
        }
        await PublishAllAsync(tenantId, sessionId, LiveEventNames.QuestionOpened, state, cancellationToken);
        return Ok(state);
    }

    [HttpPost("questions/close")]
    public async Task<IActionResult> Close(
        Guid tenantId,
        Guid quizId,
        Guid sessionId,
        [FromBody] LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureRouteAsync(quizId, sessionId, cancellationToken);
        var (error, state) = await _liveSessions.CloseCurrentAsync(sessionId, request, cancellationToken);
        if (error is not null) throw error;

        await PublishAllAsync(tenantId, sessionId, LiveEventNames.QuestionClosed, state!, cancellationToken);
        await PublishAllAsync(tenantId, sessionId, LiveEventNames.LeaderboardUpdated, state!, cancellationToken);
        return Ok(state);
    }

    [HttpPost("finish")]
    public async Task<IActionResult> Finish(
        Guid tenantId,
        Guid quizId,
        Guid sessionId,
        [FromBody] LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureRouteAsync(quizId, sessionId, cancellationToken);
        var (error, state) = await _liveSessions.FinishAsync(sessionId, request, cancellationToken);
        if (error is not null) throw error;

        await PublishAllAsync(tenantId, sessionId, LiveEventNames.SessionFinished, state!, cancellationToken);
        return Ok(state);
    }

    private async Task EnsureRouteAsync(Guid quizId, Guid sessionId, CancellationToken cancellationToken)
    {
        if (!await _db.QuizSessions.AnyAsync(
                session => session.Id == sessionId && session.QuizId == quizId && session.Mode == SessionMode.Live,
                cancellationToken))
        {
            throw new ServiceResultException("NotFound", "Live session not found.");
        }
    }

    private async Task<LiveSessionStateResponse> RequireStateAsync(
        Guid sessionId,
        CancellationToken cancellationToken) =>
        await _liveSessions.GetForTeacherAsync(sessionId, cancellationToken)
        ?? throw new ServiceResultException("NotFound", "Live session not found.");

    private async Task PublishAllAsync(
        Guid tenantId,
        Guid sessionId,
        string eventName,
        LiveSessionStateResponse state,
        CancellationToken cancellationToken)
    {
        await _hub.Clients.Group(LiveHubGroups.Teachers(tenantId, sessionId))
            .SendAsync(eventName, state, cancellationToken);
        await _hub.Clients.Group(LiveHubGroups.Players(tenantId, sessionId))
            .SendAsync(eventName, state, cancellationToken);
    }
}
