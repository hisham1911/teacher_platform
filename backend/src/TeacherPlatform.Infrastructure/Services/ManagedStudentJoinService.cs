using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record ManagedStudentJoinResult(JoinSessionResponse Player, string RawGuestToken);

public sealed class ManagedStudentJoinService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly StudentService _studentService;
    private readonly GuestTokenService _guestTokenService;
    private readonly IOptions<SessionOptions> _sessionOptions;
    private readonly IClock _clock;
    private readonly CommercialPolicyService _commercial;

    public ManagedStudentJoinService(
        AppDbContext db,
        TenantContext tenantContext,
        StudentService studentService,
        GuestTokenService guestTokenService,
        IOptions<SessionOptions> sessionOptions,
        IClock clock,
        CommercialPolicyService commercial)
    {
        _db = db;
        _tenantContext = tenantContext;
        _studentService = studentService;
        _guestTokenService = guestTokenService;
        _sessionOptions = sessionOptions;
        _clock = clock;
        _commercial = commercial;
    }

    public async Task<ManagedStudentJoinResult> JoinAsync(string joinCode, string studentCode, CancellationToken cancellationToken)
    {
        var session = await ResolveJoinableSessionAsync(joinCode, cancellationToken);
        var identity = await _studentService.ResolveActiveByCodeAsync(session.TenantId, studentCode, cancellationToken);
        if (identity is null) throw new ServiceResultException("NotFound", "Student code is invalid or inactive.");
        return await JoinResolvedAsync(session, identity.Id, identity.TenantId, identity.FullName, cancellationToken);
    }

    public async Task<ManagedStudentJoinResult> JoinPortalAsync(
        string joinCode, StudentPortalIdentity identity, CancellationToken cancellationToken)
    {
        var session = await ResolveJoinableSessionAsync(joinCode, cancellationToken);
        if (session.TenantId != identity.TenantId)
            throw new ServiceResultException("NotFound", "Student portal is not valid for this activity.");
        return await JoinResolvedAsync(session, identity.StudentId, identity.TenantId, identity.FullName, cancellationToken);
    }

    private async Task<ManagedStudentJoinResult> JoinResolvedAsync(
        JoinableSession session, Guid studentId, Guid studentTenantId, string fullName, CancellationToken cancellationToken)
    {
        if (session.TenantId != studentTenantId)
            throw new ServiceResultException("NotFound", "Student identity is not valid for this activity.");

        using var tenantScope = _tenantContext.BeginBootstrap(session.TenantId);
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _commercial.AcquireCapacityLockAsync(
            session.TenantId, CommercialCapacity.LiveParticipants, cancellationToken, session.Id);

        // Re-check after acquiring the lock: two devices may have raced before either insert committed.
        var existing = await _db.SessionParticipants.Include(participant => participant.Attempt)
            .SingleOrDefaultAsync(participant => participant.SessionId == session.Id && participant.StudentId == studentId, cancellationToken);
        if (existing is not null)
        {
            var rotated = await RotateTokenAsync(existing, fullName, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return rotated;
        }

        var participantCount = await _db.SessionParticipants.LongCountAsync(
            participant => participant.SessionId == session.Id, cancellationToken);
        var commercialLimit = await _commercial.GetCapacityLimitAsync(
            session.TenantId, CommercialCapacity.LiveParticipants, cancellationToken);
        var effectiveLimit = Math.Min(_sessionOptions.Value.MaxParticipantsPerSession, commercialLimit);
        if (participantCount >= effectiveLimit)
            throw new ServiceResultException("QuotaExceeded", $"This activity reached the live participant limit ({effectiveLimit}). Upgrade the plan to allow more participants.");

        var rawToken = GuestTokenService.GenerateRawToken();
        var now = _clock.UtcNow;
        var participant = new SessionParticipant
        {
            Id = Guid.NewGuid(), TenantId = session.TenantId, SessionId = session.Id, StudentId = studentId,
            DisplayName = fullName, GuestTokenHash = GuestTokenService.ComputeHash(rawToken),
            GuestTokenExpiresAt = _guestTokenService.ComputeExpiry(_sessionOptions.Value.GuestTokenDays),
            JoinedAt = now, CreatedAt = now, UpdatedAt = now
        };
        _db.SessionParticipants.Add(participant);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new ManagedStudentJoinResult(ToJoinResponse(participant), rawToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            // Defensive fallback; the advisory lock should normally make this path unreachable.
            await transaction.RollbackAsync(cancellationToken);
            var racedParticipant = await _db.SessionParticipants.IgnoreQueryFilters().Include(item => item.Attempt)
                .SingleOrDefaultAsync(item => item.TenantId == session.TenantId && item.SessionId == session.Id && item.StudentId == studentId, cancellationToken);
            if (racedParticipant is null) throw;
            using var secondScope = _tenantContext.BeginBootstrap(session.TenantId);
            return await RotateTokenAsync(racedParticipant, fullName, cancellationToken);
        }
    }

    private async Task<JoinableSession> ResolveJoinableSessionAsync(string joinCode, CancellationToken cancellationToken)
    {
        var normalizedJoinCode = joinCode.Trim().ToUpperInvariant();
        var session = await _db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(item => item.JoinCode == normalizedJoinCode)
            .Select(item => new JoinableSession(item.Id, item.TenantId, item.Status))
            .SingleOrDefaultAsync(cancellationToken);
        if (session is null) throw new ServiceResultException("NotFound", "Activity not found.");
        if (session.Status != SessionStatus.Active) throw new ServiceResultException("Conflict", "This activity is not accepting students now.");
        return session;
    }

    private async Task<ManagedStudentJoinResult> RotateTokenAsync(SessionParticipant participant, string authoritativeName, CancellationToken cancellationToken)
    {
        var rawToken = GuestTokenService.GenerateRawToken();
        participant.DisplayName = authoritativeName;
        participant.GuestTokenHash = GuestTokenService.ComputeHash(rawToken);
        participant.GuestTokenExpiresAt = _guestTokenService.ComputeExpiry(_sessionOptions.Value.GuestTokenDays);
        participant.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return new ManagedStudentJoinResult(ToJoinResponse(participant), rawToken);
    }

    private static JoinSessionResponse ToJoinResponse(SessionParticipant participant) => new()
    {
        ParticipantId = participant.Id, DisplayName = participant.DisplayName,
        AttemptId = participant.Attempt?.Id, AttemptStatus = participant.Attempt?.Status.ToString()
    };

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private sealed record JoinableSession(Guid Id, Guid TenantId, SessionStatus Status);
}
