using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record ManagedStudentJoinResult(JoinSessionResponse Player, string RawGuestToken);

/// <summary>
/// نقطة الربط الوحيدة بين سجل الطلاب ومحرك اللعب.
/// StudentCode يُستخدم مرة واحدة لإثبات هوية الطالب داخل Tenant الجلسة، ثم تستمر كل عمليات اللعب بالـGuest Token الحالي؛
/// وبذلك لا نكرر منطق التقييم/الاستئناف ولا نرسل StudentCode مع كل إجابة.
/// </summary>
public sealed class ManagedStudentJoinService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly StudentService _studentService;
    private readonly GuestTokenService _guestTokenService;
    private readonly IOptions<SessionOptions> _sessionOptions;
    private readonly IClock _clock;

    public ManagedStudentJoinService(
        AppDbContext db,
        TenantContext tenantContext,
        StudentService studentService,
        GuestTokenService guestTokenService,
        IOptions<SessionOptions> sessionOptions,
        IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _studentService = studentService;
        _guestTokenService = guestTokenService;
        _sessionOptions = sessionOptions;
        _clock = clock;
    }

    public async Task<ManagedStudentJoinResult> JoinAsync(
        string joinCode,
        string studentCode,
        CancellationToken cancellationToken)
    {
        var normalizedJoinCode = joinCode.Trim().ToUpperInvariant();
        var session = await _db.QuizSessions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.JoinCode == normalizedJoinCode)
            .Select(item => new { item.Id, item.TenantId, item.Status })
            .SingleOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            throw new ServiceResultException("NotFound", "Activity not found.");
        }

        if (session.Status != SessionStatus.Active)
        {
            throw new ServiceResultException("Conflict", "This activity is not accepting students now.");
        }

        var identity = await _studentService.ResolveActiveByCodeAsync(session.TenantId, studentCode, cancellationToken);
        if (identity is null)
        {
            // رسالة موحدة حتى لا يتحول المسار إلى oracle لمعرفة الطلاب غير النشطين أو رموز Tenants أخرى.
            throw new ServiceResultException("NotFound", "Student code is invalid or inactive.");
        }

        using var tenantScope = _tenantContext.BeginBootstrap(session.TenantId);

        var existing = await _db.SessionParticipants
            .Include(participant => participant.Attempt)
            .SingleOrDefaultAsync(
                participant => participant.SessionId == session.Id && participant.StudentId == identity.Id,
                cancellationToken);

        if (existing is not null)
        {
            return await RotateTokenAsync(existing, identity.FullName, cancellationToken);
        }

        var participantCount = await _db.SessionParticipants.CountAsync(
            participant => participant.SessionId == session.Id,
            cancellationToken);
        if (participantCount >= _sessionOptions.Value.MaxParticipantsPerSession)
        {
            throw new ServiceResultException("Conflict", "This activity has reached the participant limit.");
        }

        var rawToken = GuestTokenService.GenerateRawToken();
        var now = _clock.UtcNow;
        var participant = new SessionParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = session.TenantId,
            SessionId = session.Id,
            StudentId = identity.Id,
            DisplayName = identity.FullName,
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
            // سباق نادر: فتح الطالب نفس النشاط في جهازين في اللحظة نفسها. نحتفظ بمشارك واحد ونُدوّر رمزه.
            _db.Entry(participant).State = EntityState.Detached;
            var racedParticipant = await _db.SessionParticipants
                .Include(item => item.Attempt)
                .SingleOrDefaultAsync(
                    item => item.SessionId == session.Id && item.StudentId == identity.Id,
                    cancellationToken);
            if (racedParticipant is null)
            {
                throw;
            }

            return await RotateTokenAsync(racedParticipant, identity.FullName, cancellationToken);
        }
    }

    private async Task<ManagedStudentJoinResult> RotateTokenAsync(
        SessionParticipant participant,
        string authoritativeName,
        CancellationToken cancellationToken)
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

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
