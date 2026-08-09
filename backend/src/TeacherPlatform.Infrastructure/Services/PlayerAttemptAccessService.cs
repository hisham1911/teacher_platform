using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record PlayerAttemptAccess(QuizSession Session, SessionParticipant Participant, Attempt Attempt);

public sealed class PlayerAttemptAccessService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public PlayerAttemptAccessService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<(ServiceResultException? Error, PlayerAttemptAccess? Access)> ResolveAsync(
        string joinCode,
        Guid attemptId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var session = await _db.QuizSessions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(current => current.Quiz)
            .SingleOrDefaultAsync(current => current.JoinCode == joinCode, cancellationToken);
        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null);
        }

        var participant = await ResolveParticipantAsync(session, rawToken, cancellationToken);
        if (participant is null)
        {
            return (new ServiceResultException("Unauthorized", "Guest token is invalid or expired."), null);
        }

        var attempt = await _db.Attempts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(current =>
                current.Id == attemptId &&
                current.SessionId == session.Id &&
                current.ParticipantId == participant.Id &&
                current.TenantId == session.TenantId,
                cancellationToken);
        return attempt is null
            ? (new ServiceResultException("NotFound", "Attempt not found."), null)
            : (null, new PlayerAttemptAccess(session, participant, attempt));
    }

    public async Task<(ServiceResultException? Error, PlayerAttemptAccess? Access)> ResolveCompletedAsync(
        string joinCode,
        Guid attemptId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveAsync(joinCode, attemptId, rawToken, cancellationToken);
        if (resolved.Error is not null || resolved.Access is null)
        {
            return resolved;
        }

        return resolved.Access.Attempt.Status == AttemptStatus.InProgress
            ? (new ServiceResultException("AttemptNotCompleted", "The attempt must be completed first."), null)
            : resolved;
    }

    private async Task<SessionParticipant?> ResolveParticipantAsync(
        QuizSession session,
        string rawToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(rawToken)) return null;

        var tokenHash = GuestTokenService.ComputeHash(rawToken);
        var participant = await _db.SessionParticipants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(current =>
                current.SessionId == session.Id &&
                current.TenantId == session.TenantId &&
                current.GuestTokenHash == tokenHash,
                cancellationToken);

        return participant is not null &&
               participant.GuestTokenExpiresAt > _clock.UtcNow &&
               GuestTokenService.Verify(rawToken, participant.GuestTokenHash)
            ? participant
            : null;
    }
}
