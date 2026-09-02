using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Application.Tenancy;
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

    public ManagedStudentJoinService(AppDbContext db, TenantContext tenantContext, StudentService studentService, GuestTokenService guestTokenService, IOptions<SessionOptions> sessionOptions, IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _studentService = studentService;
        _guestTokenService = guestTokenService;
        _sessionOptions = sessionOptions;
        _clock = clock;
    }

    public async Task<ManagedStudentJoinResult> JoinAsync(string joinCode, string studentCode, CancellationToken cancellationToken)
    {
        var session = await ResolveJoinableSessionAsync(joinCode, cancellationToken, allowAssignment: false);
        var identity = await _studentService.ResolveActiveByCodeAsync(session.TenantId, studentCode, cancellationToken);
        if (identity is null) throw new ServiceResultException("NotFound", "Student code is invalid or inactive.");
        return await JoinResolvedAsync(session, identity.Id, identity.TenantId, identity.FullName, cancellationToken);
    }

    public async Task<ManagedStudentJoinResult> JoinPortalAsync(string joinCode, StudentPortalIdentity identity, CancellationToken cancellationToken)
    {
        var session = await ResolveJoinableSessionAsync(joinCode, cancellationToken, allowAssignment: false);
        if (session.TenantId != identity.TenantId) throw new ServiceResultException("NotFound", "Student portal is not valid for this activity.");
        return await JoinResolvedAsync(session, identity.StudentId, identity.TenantId, identity.FullName, cancellationToken);
    }

    /// <summary>
    /// يستخدمه AssignmentService فقط بعد إثبات recipient access. لا يقبل JoinCode من العميل.
    /// </summary>
    public async Task<ManagedStudentJoinResult> JoinAssignmentSessionAsync(Guid sessionId, StudentPortalIdentity identity, CancellationToken cancellationToken)
    {
        var session = await _db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == sessionId && x.TenantId == identity.TenantId)
            .Select(x => new JoinableSession(x.Id, x.TenantId, x.Status, x.AccessKind))
            .SingleOrDefaultAsync(cancellationToken);
        if (session is null || session.AccessKind != SessionAccessKind.ManagedAssignment)
            throw new ServiceResultException("NotFound", "Task activity not found.");
        if (session.Status != SessionStatus.Active)
            throw new ServiceResultException("Conflict", "This activity is not accepting students now.");
        return await JoinResolvedAsync(session, identity.StudentId, identity.TenantId, identity.FullName, cancellationToken);
    }

    private async Task<ManagedStudentJoinResult> JoinResolvedAsync(JoinableSession session, Guid studentId, Guid studentTenantId, string fullName, CancellationToken cancellationToken)
    {
        if (session.TenantId != studentTenantId) throw new ServiceResultException("NotFound", "Student identity is not valid for this activity.");
        using var tenantScope = _tenantContext.BeginBootstrap(session.TenantId);

        var existing = await _db.SessionParticipants.Include(p => p.Attempt)
            .SingleOrDefaultAsync(p => p.SessionId == session.Id && p.StudentId == studentId, cancellationToken);
        if (existing is not null) return await RotateTokenAsync(existing, fullName, cancellationToken);

        var participantCount = await _db.SessionParticipants.CountAsync(p => p.SessionId == session.Id, cancellationToken);
        if (participantCount >= _sessionOptions.Value.MaxParticipantsPerSession)
            throw new ServiceResultException("Conflict", "This activity has reached the participant limit.");

        var rawToken = GuestTokenService.GenerateRawToken();
        var now = _clock.UtcNow;
        var participant = new SessionParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = session.TenantId,
            SessionId = session.Id,
            StudentId = studentId,
            DisplayName = fullName,
            GuestTokenHash = GuestTokenService.ComputeHash(rawToken),
            GuestTokenExpiresAt = _guestTokenService.ComputeExpiry(_sessionOptions.Value.GuestTokenDays),
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.SessionParticipants.Add(participant);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return new ManagedStudentJoinResult(ToJoinResponse(participant), rawToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            _db.Entry(participant).State = EntityState.Detached;
            var raced = await _db.SessionParticipants.Include(p => p.Attempt)
                .SingleOrDefaultAsync(p => p.SessionId == session.Id && p.StudentId == studentId, cancellationToken);
            if (raced is null) throw;
            return await RotateTokenAsync(raced, fullName, cancellationToken);
        }
    }

    private async Task<JoinableSession> ResolveJoinableSessionAsync(string joinCode, CancellationToken cancellationToken, bool allowAssignment)
    {
        var normalized = joinCode.Trim().ToUpperInvariant();
        var session = await _db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.JoinCode == normalized)
            .Select(x => new JoinableSession(x.Id, x.TenantId, x.Status, x.AccessKind))
            .SingleOrDefaultAsync(cancellationToken);
        if (session is null || (!allowAssignment && session.AccessKind == SessionAccessKind.ManagedAssignment))
            throw new ServiceResultException("NotFound", "Activity not found.");
        if (session.Status != SessionStatus.Active)
            throw new ServiceResultException("Conflict", "This activity is not accepting students now.");
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
        ParticipantId = participant.Id,
        DisplayName = participant.DisplayName,
        AttemptId = participant.Attempt?.Id,
        AttemptStatus = participant.Attempt?.Status.ToString()
    };

    private static bool IsUniqueViolation(DbUpdateException exception) => exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
    private sealed record JoinableSession(Guid Id, Guid TenantId, SessionStatus Status, SessionAccessKind AccessKind);
}
