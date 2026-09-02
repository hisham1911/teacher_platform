using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Assignments;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Assignments;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class AssignmentService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly IOptions<SessionOptions> _sessionOptions;
    private readonly ManagedStudentJoinService _managedJoin;

    public AssignmentService(AppDbContext db, ITenantContext tenantContext, IClock clock, IOptions<SessionOptions> sessionOptions, ManagedStudentJoinService managedJoin)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
        _sessionOptions = sessionOptions;
        _managedJoin = managedJoin;
    }

    public async Task<AssignmentDetailResponse> CreateAsync(CreateAssignmentRequest request, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var now = _clock.UtcNow;
        ValidateDates(request.AvailableAt, request.DueAt, now);

        var version = await _db.QuizVersions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == request.QuizVersionId, cancellationToken);
        if (version is null || version.Status == QuizVersionStatus.Draft || version.PublishedAt is null)
            throw new ServiceResultException("NotFound", "Published activity version not found.");

        var directIds = request.StudentIds.Where(x => x != Guid.Empty).Distinct().ToArray();
        var classroomIds = request.ClassroomIds.Where(x => x != Guid.Empty).Distinct().ToArray();
        if (directIds.Length == 0 && classroomIds.Length == 0)
            throw new ServiceResultException("Validation", "Choose at least one classroom or student.");

        var directStudents = await _db.Students.AsNoTracking()
            .Where(x => directIds.Contains(x.Id) && x.IsActive)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        if (directStudents.Count != directIds.Length)
            throw new ServiceResultException("NotFound", "One or more students were not found or inactive.");

        var classrooms = await _db.Classrooms.AsNoTracking()
            .Where(x => classroomIds.Contains(x.Id) && x.IsActive)
            .Select(x => new
            {
                x.Id,
                Students = x.Students.Where(m => m.Student!.IsActive).Select(m => m.StudentId).ToList()
            })
            .ToListAsync(cancellationToken);
        if (classrooms.Count != classroomIds.Length)
            throw new ServiceResultException("NotFound", "One or more classrooms were not found or inactive.");

        var recipients = new Dictionary<Guid, Guid?>();
        foreach (var studentId in directStudents) recipients[studentId] = null;
        foreach (var classroom in classrooms.OrderBy(x => x.Id))
            foreach (var studentId in classroom.Students)
                recipients.TryAdd(studentId, classroom.Id);
        if (recipients.Count == 0)
            throw new ServiceResultException("Validation", "The selected recipients contain no active students.");

        var joinCode = await AllocateJoinCodeAsync(cancellationToken);
        var sessionId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        _db.QuizSessions.Add(new QuizSession
        {
            Id = sessionId,
            TenantId = tenantId,
            QuizId = version.QuizId,
            QuizVersionId = version.Id,
            JoinCode = joinCode,
            AccessKind = SessionAccessKind.ManagedAssignment,
            Mode = SessionMode.SelfPaced,
            Status = SessionStatus.Active,
            Label = "Assigned activity",
            ActivatedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });

        _db.Assignments.Add(new Assignment
        {
            Id = assignmentId,
            TenantId = tenantId,
            QuizVersionId = version.Id,
            SessionId = sessionId,
            AvailableAt = request.AvailableAt,
            DueAt = request.DueAt,
            CreatedAt = now,
            UpdatedAt = now
        });

        foreach (var pair in recipients)
        {
            _db.AssignmentRecipients.Add(new AssignmentRecipient
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                AssignmentId = assignmentId,
                StudentId = pair.Key,
                SourceClassroomId = pair.Value,
                CreatedAt = now
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (await GetAsync(assignmentId, cancellationToken))!;
    }

    public async Task<IReadOnlyList<AssignmentResponse>> ListAsync(CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Assignments.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new AssignmentResponse
            {
                Id = x.Id,
                QuizVersionId = x.QuizVersionId,
                QuizId = x.QuizVersion!.QuizId,
                ActivityTitle = x.QuizVersion.TitleSnapshot,
                AvailableAt = x.AvailableAt,
                DueAt = x.DueAt,
                RecipientCount = x.Recipients.Count,
                StartedCount = x.Session!.Attempts.Count,
                CompletedCount = x.Session.Attempts.Count(a => a.Status != AttemptStatus.InProgress),
                Version = x.Version,
                CreatedAt = x.CreatedAt
            }).ToListAsync(cancellationToken);
    }

    public async Task<AssignmentDetailResponse?> GetAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Assignments.AsNoTracking()
            .Where(x => x.Id == assignmentId)
            .Select(x => new AssignmentDetailResponse
            {
                Id = x.Id,
                QuizVersionId = x.QuizVersionId,
                QuizId = x.QuizVersion!.QuizId,
                ActivityTitle = x.QuizVersion.TitleSnapshot,
                AvailableAt = x.AvailableAt,
                DueAt = x.DueAt,
                RecipientCount = x.Recipients.Count,
                StartedCount = x.Session!.Attempts.Count,
                CompletedCount = x.Session.Attempts.Count(a => a.Status != AttemptStatus.InProgress),
                Version = x.Version,
                CreatedAt = x.CreatedAt,
                Recipients = x.Recipients.OrderBy(r => r.Student!.FullName).Select(r => new AssignmentRecipientResponse
                {
                    StudentId = r.StudentId,
                    StudentName = r.Student!.FullName,
                    SourceClassroomId = r.SourceClassroomId,
                    SourceClassroomName = r.SourceClassroom != null ? r.SourceClassroom.Name : null
                }).ToList()
            }).SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AssignmentRecipientResponse>> ListRecipientsAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        var detail = await GetAsync(assignmentId, cancellationToken);
        if (detail is null) throw new ServiceResultException("NotFound", "Assignment not found.");
        return detail.Recipients;
    }

    public async Task<IReadOnlyList<AssignmentResultResponse>> ListResultsAsync(Guid assignmentId, CancellationToken cancellationToken)
    {
        RequireTenant();
        var assignment = await _db.Assignments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == assignmentId, cancellationToken);
        if (assignment is null) throw new ServiceResultException("NotFound", "Assignment not found.");

        return await _db.AssignmentRecipients.AsNoTracking()
            .Where(r => r.AssignmentId == assignmentId)
            .OrderBy(r => r.Student!.FullName)
            .Select(r => new AssignmentResultResponse
            {
                StudentId = r.StudentId,
                StudentName = r.Student!.FullName,
                AttemptId = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => (Guid?)a.Id).FirstOrDefault(),
                Status = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => a.Status.ToString()).FirstOrDefault(),
                Score = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => a.Score).FirstOrDefault(),
                MaxScore = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => a.MaxScore).FirstOrDefault(),
                Percentage = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => a.Percentage).FirstOrDefault(),
                Passed = _db.Attempts.Where(a => a.SessionId == assignment.SessionId && a.Participant!.StudentId == r.StudentId).Select(a => a.Passed).FirstOrDefault()
            }).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentTaskResponse>> ListForStudentAsync(StudentPortalIdentity identity, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var recipients = await _db.AssignmentRecipients.IgnoreQueryFilters().AsNoTracking()
            .Where(r => r.TenantId == identity.TenantId && r.StudentId == identity.StudentId)
            .Include(r => r.Assignment)!.ThenInclude(a => a!.QuizVersion)!.ThenInclude(v => v!.Items)
            .OrderByDescending(r => r.Assignment!.CreatedAt)
            .ToListAsync(cancellationToken);

        if (recipients.Count == 0) return [];
        var sessionIds = recipients.Select(r => r.Assignment!.SessionId).Distinct().ToArray();
        var attempts = await _db.Attempts.IgnoreQueryFilters().AsNoTracking()
            .Include(a => a.Answers)
            .Include(a => a.Participant)
            .Where(a => a.TenantId == identity.TenantId && sessionIds.Contains(a.SessionId) && a.Participant!.StudentId == identity.StudentId)
            .ToListAsync(cancellationToken);
        var bySession = attempts.ToDictionary(a => a.SessionId);
        var attemptIds = attempts.Select(a => a.Id).ToArray();
        var certificates = await _db.Certificates.IgnoreQueryFilters().AsNoTracking()
            .Where(c => c.TenantId == identity.TenantId && attemptIds.Contains(c.AttemptId) && c.Status == Domain.Certificates.CertificateStatus.Ready)
            .GroupBy(c => c.AttemptId)
            .Select(g => new { AttemptId = g.Key, CertificateId = g.Select(c => c.Id).First() })
            .ToDictionaryAsync(x => x.AttemptId, x => x.CertificateId, cancellationToken);

        return recipients.Select(r =>
        {
            var assignment = r.Assignment!;
            bySession.TryGetValue(assignment.SessionId, out var attempt);
            var itemCount = Math.Max(assignment.QuizVersion?.Items.Count ?? 0, 1);
            var state = assignment.AvailableAt is { } available && available > now
                ? "Upcoming"
                : attempt is null ? "New" : attempt.Status == AttemptStatus.InProgress ? "InProgress" : "Completed";
            var progress = attempt is null ? 0m : attempt.Status == AttemptStatus.InProgress
                ? Math.Min(100m, decimal.Round(attempt.Answers.Count * 100m / itemCount, 0))
                : 100m;
            return new StudentTaskResponse
            {
                Id = assignment.Id,
                ActivityTitle = assignment.QuizVersion?.TitleSnapshot ?? string.Empty,
                State = state,
                AvailableAt = assignment.AvailableAt,
                DueAt = assignment.DueAt,
                ProgressPercentage = progress,
                Score = attempt?.Score,
                MaxScore = attempt?.MaxScore,
                ResultPercentage = attempt?.Percentage,
                Passed = attempt?.Passed,
                CertificateId = attempt is not null && certificates.TryGetValue(attempt.Id, out var certId) ? certId : null
            };
        }).ToList();
    }

    public async Task<(StartStudentTaskResponse Response, string RawGuestToken)> StartForStudentAsync(Guid assignmentId, StudentPortalIdentity identity, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var recipient = await _db.AssignmentRecipients.IgnoreQueryFilters().AsNoTracking()
            .Where(r => r.Id != Guid.Empty && r.TenantId == identity.TenantId && r.StudentId == identity.StudentId && r.AssignmentId == assignmentId)
            .Select(r => new { r.AssignmentId, r.Assignment!.SessionId, r.Assignment.AvailableAt, JoinCode = r.Assignment.Session!.JoinCode })
            .SingleOrDefaultAsync(cancellationToken);
        if (recipient is null) throw new ServiceResultException("NotFound", "Task not found.");
        if (recipient.AvailableAt is { } availableAt && availableAt > now)
            throw new ServiceResultException("Conflict", "This task is not available yet.");

        var joined = await _managedJoin.JoinAssignmentSessionAsync(recipient.SessionId, identity, cancellationToken);
        return (new StartStudentTaskResponse
        {
            AssignmentId = assignmentId,
            JoinCode = recipient.JoinCode,
            ParticipantId = joined.Player.ParticipantId,
            AttemptId = joined.Player.AttemptId,
            AttemptStatus = joined.Player.AttemptStatus
        }, joined.RawGuestToken);
    }

    private async Task<string> AllocateJoinCodeAsync(CancellationToken cancellationToken)
    {
        for (var i = 0; i < 12; i++)
        {
            var code = GuestTokenService.GenerateJoinCode(_sessionOptions.Value.JoinCodeLength);
            if (!await _db.QuizSessions.IgnoreQueryFilters().AnyAsync(x => x.JoinCode == code, cancellationToken)) return code;
        }
        throw new ServiceResultException("Conflict", "Could not allocate a unique activity code. Try again.");
    }

    private static void ValidateDates(DateTime? availableAt, DateTime? dueAt, DateTime now)
    {
        if (dueAt is null) return;
        var lowerBound = availableAt ?? now;
        if (dueAt <= lowerBound) throw new ServiceResultException("Validation", "DueAt must be later than AvailableAt/creation time.");
    }

    private Guid RequireTenant() => _tenantContext.IsResolved && _tenantContext.TenantId is { } id && id != Guid.Empty
        ? id
        : throw new ServiceResultException("TenantContextMissing", "Active tenant context is required.");
}
