using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Hubs;

public static class LiveHubGroups
{
    public static string Teachers(Guid tenantId, Guid sessionId) =>
        $"tenant:{tenantId}:session:{sessionId}:teacher";

    public static string Players(Guid tenantId, Guid sessionId) =>
        $"tenant:{tenantId}:session:{sessionId}:players";
}

/// <summary>
/// Hub إشعارات فقط. لا توجد methods للإجابات أو التحكم أو اختيار group من العميل.
/// </summary>
[Authorize]
public sealed class QuizHub : Hub
{
    private readonly AppDbContext _db;
    private readonly LiveSessionService _liveSessions;
    private readonly TeacherPlatform.Application.Abstractions.IClock _clock;

    public QuizHub(
        AppDbContext db,
        LiveSessionService liveSessions,
        TeacherPlatform.Application.Abstractions.IClock clock)
    {
        _db = db;
        _liveSessions = liveSessions;
        _clock = clock;
    }

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user is null ||
            !Guid.TryParse(user.FindFirstValue(LiveTokenClaims.TenantId), out var tenantId) ||
            !Guid.TryParse(user.FindFirstValue(LiveTokenClaims.SessionId), out var sessionId))
        {
            Context.Abort();
            return;
        }

        var liveRole = user.FindFirstValue(LiveTokenClaims.Role);
        if (liveRole == LiveTokenClaims.Teacher)
        {
            var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
            if (!Guid.TryParse(userIdValue, out var userId) ||
                !await CanHostAsync(userId, tenantId, sessionId, Context.ConnectionAborted))
            {
                Context.Abort();
                return;
            }

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                LiveHubGroups.Teachers(tenantId, sessionId),
                Context.ConnectionAborted);
        }
        else if (liveRole == LiveTokenClaims.Player)
        {
            if (!Guid.TryParse(user.FindFirstValue(LiveTokenClaims.ParticipantId), out var participantId) ||
                !await CanPlayAsync(participantId, tenantId, sessionId, Context.ConnectionAborted))
            {
                Context.Abort();
                return;
            }

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                LiveHubGroups.Players(tenantId, sessionId),
                Context.ConnectionAborted);
        }
        else
        {
            Context.Abort();
            return;
        }

        var state = await _liveSessions.GetForConnectionAsync(tenantId, sessionId, Context.ConnectionAborted);
        if (state is null)
        {
            Context.Abort();
            return;
        }

        await Clients.Caller.SendAsync(LiveEventNames.LiveStateChanged, state, Context.ConnectionAborted);
        if (liveRole == LiveTokenClaims.Player)
        {
            await Clients.Group(LiveHubGroups.Teachers(tenantId, sessionId))
                .SendAsync(LiveEventNames.LobbyUpdated, state, Context.ConnectionAborted);
        }

        await base.OnConnectedAsync();
    }

    private async Task<bool> CanHostAsync(
        Guid userId,
        Guid tenantId,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var sessionExists = await _db.QuizSessions
            .IgnoreQueryFilters()
            .AnyAsync(session =>
                session.Id == sessionId && session.TenantId == tenantId && session.Mode == SessionMode.Live,
                cancellationToken);
        if (!sessionExists) return false;

        return await _db.TenantMemberships
            .IgnoreQueryFilters()
            .AnyAsync(membership =>
                membership.UserId == userId &&
                membership.TenantId == tenantId &&
                membership.Status == TenantMembershipStatus.Active &&
                (membership.Role == TenantMemberRole.Owner || membership.Role == TenantMemberRole.Teacher),
                cancellationToken);
    }

    private Task<bool> CanPlayAsync(
        Guid participantId,
        Guid tenantId,
        Guid sessionId,
        CancellationToken cancellationToken) =>
        _db.SessionParticipants
            .IgnoreQueryFilters()
            .AnyAsync(participant =>
                participant.Id == participantId &&
                participant.TenantId == tenantId &&
                participant.SessionId == sessionId &&
                participant.GuestTokenExpiresAt > _clock.UtcNow &&
                participant.Session != null &&
                participant.Session.Mode == SessionMode.Live,
                cancellationToken);
}
