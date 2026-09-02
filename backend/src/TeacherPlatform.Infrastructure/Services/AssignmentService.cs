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
    private readonly CommercialPolicyService _commercial;

    public AssignmentService(
        AppDbContext db,
        ITenantContext tenantContext,
        IClock clock,
        IOptions<SessionOptions> sessionOptions,
        ManagedStudentJoinService managedJoin,
        CommercialPolicyService commercial)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
        _sessionOptions = sessionOptions;
        _managedJoin = managedJoin;
        _commercial = commercial;
    }

    public async Task<AssignmentDetailResponse> CreateAsync(
        CreateAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var now = _clock.UtcNow;
        if (!AssignmentScheduleRules.IsValid(request.AvailableAt, request.DueAt, now))
        {
            throw new ServiceResultException(
                "Validation",
                "DueAt must be later than AvailableAt/creation time.");
        }

        var version = await _db.QuizVersions
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == request.QuizVersionId, cancellationToken);
        if (version is null || version.Status == QuizVersionStatus.Draft || version.PublishedAt is null)
        {
            throw new ServiceResultException("NotFound", "Published activity version not found.");
        }

        var directIds = request.StudentIds
            .Where(item => item != Guid.Empty)
            .Distinct()
            .ToArray();
        var classroomIds = request.ClassroomIds
            .Where(item => item != Guid.Empty)
            .Distinct()
            .ToArray();
        if (directIds.Length == 0 && classroomIds.Length == 0)
        {
            throw new ServiceResultException("Validation", "Choose at least one classroom or student.");
        }

        var directStudents = await _db.Students
            .AsNoTracking()
            .Where(item => directIds.Contains(item.Id) && item.IsActive)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);
        if (directStudents.Count != directIds.Length)
        {
            throw new ServiceResultException(
                "NotFound",
                "One or more students were not found or inactive.");
        }

        var classrooms = await _db.Classrooms
            .AsNoTracking()
            .Where(item => classroomIds.Contains(item.Id) && item.IsActive)
            .Select(item => new
            {
                item.Id,
                Students = item.Students
                    .Where(member => member.Student!.IsActive)
                    .Select(member => member.StudentId)
                    .ToList()
            })
            .ToListAsync(cancellationToken);
        if (classrooms.Count != classroomIds.Length)
        {
            throw new ServiceResultException(
                "NotFound",
                "One or more classrooms were not found or inactive.");
        }

        var recipients = new Dictionary<Guid, Guid?>();
        foreach (var studentId in directStudents)
        {
            recipients[studentId] = null;
        }

        foreach (var classroom in classrooms.OrderBy(item => item.Id))
        {
            foreach (var studentId in classroom.Students)
            {
                recipients.TryAdd(studentId, classroom.Id);
            }
        }

        if (recipients.Count == 0)
        {
            throw new ServiceResultException(
                "Validation",
                "The selected recipients contain no active students.");
        }

        var joinCode = await AllocateJoinCodeAsync(cancellationToken);
        var sessionId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _commercial.AcquireCapacityLockAsync(
            tenantId,
            CommercialCapacity.ActiveAssignments,
            cancellationToken);
        var activeCount = await _db.Assignments.LongCountAsync(
            item => item.Session!.Status == SessionStatus.Active,
            cancellationToken);
        await _commercial.EnsureCapacityAsync(
            tenantId,
            CommercialCapacity.ActiveAssignments,
            activeCount,
            cancellationToken);

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

    public async Task<IReadOnlyList<AssignmentResponse>> ListAsync(
        CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Assignments
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new AssignmentResponse
            {
                Id = item.Id,
                QuizVersionId = item.QuizVersionId,
                QuizId = item.QuizVersion!.QuizId,
                ActivityTitle = item.QuizVersion.TitleSnapshot,
                AvailableAt = item.AvailableAt,
                DueAt = item.DueAt,
                RecipientCount = item.Recipients.Count,
                StartedCount = item.Session!.Attempts.Count,
                CompletedCount = item.Session.Attempts.Count(attempt => attempt.Status != AttemptStatus.InProgress),
                Version = item.Version,
                CreatedAt = item.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<AssignmentDetailResponse?> GetAsync(
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Assignments
            .AsNoTracking()
            .Where(item => item.Id == assignmentId)
            .Select(item => new AssignmentDetailResponse
            {
                Id = item.Id,
                QuizVersionId = item.QuizVersionId,
                QuizId = item.QuizVersion!.QuizId,
                ActivityTitle = item.QuizVersion.TitleSnapshot,
                AvailableAt = item.AvailableAt,
                DueAt = item.DueAt,
                RecipientCount = item.Recipients.Count,
                StartedCount = item.Session!.Attempts.Count,
                CompletedCount = item.Session.Attempts.Count(attempt => attempt.Status != AttemptStatus.InProgress),
                Version = item.Version,
                CreatedAt = item.CreatedAt,
                Recipients = item.Recipients
                    .OrderBy(recipient => recipient.Student!.FullName)
                    .Select(recipient => new AssignmentRecipientResponse
                    {
                        StudentId = recipient.StudentId,
                        StudentName = recipient.Student!.FullName,
                        SourceClassroomId = recipient.SourceClassroomId,
                        SourceClassroomName = recipient.SourceClassroom != null
                            ? recipient.SourceClassroom.Name
                            : null
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AssignmentRecipientResponse>> ListRecipientsAsync(
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        var detail = await GetAsync(assignmentId, cancellationToken);
        if (detail is null)
        {
            throw new ServiceResultException("NotFound", "Assignment not found.");
        }

        return detail.Recipients;
    }

    public async Task<IReadOnlyList<AssignmentResultResponse>> ListResultsAsync(
        Guid assignmentId,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var assignment = await _db.Assignments
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == assignmentId, cancellationToken);
        if (assignment is null)
        {
            throw new ServiceResultException("NotFound", "Assignment not found.");
        }

        return await _db.AssignmentRecipients
            .AsNoTracking()
            .Where(recipient => recipient.AssignmentId == assignmentId)
            .OrderBy(recipient => recipient.Student!.FullName)
            .Select(recipient => new AssignmentResultResponse
            {
                StudentId = recipient.StudentId,
                StudentName = recipient.Student!.FullName,
                AttemptId = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => (Guid?)attempt.Id)
                    .FirstOrDefault(),
                Status = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => attempt.Status.ToString())
                    .FirstOrDefault(),
                Score = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => attempt.Score)
                    .FirstOrDefault(),
                MaxScore = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => attempt.MaxScore)
                    .FirstOrDefault(),
                Percentage = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => attempt.Percentage)
                    .FirstOrDefault(),
                Passed = _db.Attempts
                    .Where(attempt => attempt.SessionId == assignment.SessionId
                        && attempt.Participant!.StudentId == recipient.StudentId)
                    .Select(attempt => attempt.Passed)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentTaskResponse>> ListForStudentAsync(
        StudentPortalIdentity identity,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var recipients = await _db.AssignmentRecipients
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(recipient => recipient.TenantId == identity.TenantId
                && recipient.StudentId == identity.StudentId)
            .Include(recipient => recipient.Assignment)!
                .ThenInclude(assignment => assignment!.QuizVersion)!
                .ThenInclude(version => version!.Items)
            .OrderByDescending(recipient => recipient.Assignment!.CreatedAt)
            .ToListAsync(cancellationToken);

        if (recipients.Count == 0)
        {
            return [];
        }

        var sessionIds = recipients
            .Select(recipient => recipient.Assignment!.SessionId)
            .Distinct()
            .ToArray();
        var attempts = await _db.Attempts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(attempt => attempt.Answers)
            .Include(attempt => attempt.Participant)
            .Where(attempt => attempt.TenantId == identity.TenantId
                && sessionIds.Contains(attempt.SessionId)
                && attempt.Participant!.StudentId == identity.StudentId)
            .ToListAsync(cancellationToken);
        var bySession = attempts.ToDictionary(attempt => attempt.SessionId);
        var attemptIds = attempts.Select(attempt => attempt.Id).ToArray();
        var certificates = await _db.Certificates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(certificate => certificate.TenantId == identity.TenantId
                && attemptIds.Contains(certificate.AttemptId)
                && certificate.Status == Domain.Certificates.CertificateStatus.Ready)
            .GroupBy(certificate => certificate.AttemptId)
            .Select(group => new
            {
                AttemptId = group.Key,
                CertificateId = group.Select(certificate => certificate.Id).First()
            })
            .ToDictionaryAsync(
                item => item.AttemptId,
                item => item.CertificateId,
                cancellationToken);

        return recipients.Select(recipient =>
        {
            var assignment = recipient.Assignment!;
            bySession.TryGetValue(assignment.SessionId, out var attempt);
            var itemCount = Math.Max(assignment.QuizVersion?.Items.Count ?? 0, 1);
            var state = assignment.AvailableAt is { } available && available > now
                ? "Upcoming"
                : attempt is null
                    ? "New"
                    : attempt.Status == AttemptStatus.InProgress
                        ? "InProgress"
                        : "Completed";
            var progress = attempt is null
                ? 0m
                : attempt.Status == AttemptStatus.InProgress
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
                CertificateId = attempt is not null
                    && certificates.TryGetValue(attempt.Id, out var certificateId)
                        ? certificateId
                        : null
            };
        }).ToList();
    }

    public async Task<(StartStudentTaskResponse Response, string RawGuestToken)> StartForStudentAsync(
        Guid assignmentId,
        StudentPortalIdentity identity,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var recipient = await _db.AssignmentRecipients
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.Id != Guid.Empty
                && item.TenantId == identity.TenantId
                && item.StudentId == identity.StudentId
                && item.AssignmentId == assignmentId)
            .Select(item => new
            {
                item.AssignmentId,
                item.Assignment!.SessionId,
                item.Assignment.AvailableAt,
                JoinCode = item.Assignment.Session!.JoinCode
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (recipient is null)
        {
            throw new ServiceResultException("NotFound", "Task not found.");
        }

        if (recipient.AvailableAt is { } availableAt && availableAt > now)
        {
            throw new ServiceResultException("Conflict", "This task is not available yet.");
        }

        var joined = await _managedJoin.JoinAssignmentSessionAsync(
            recipient.SessionId,
            identity,
            cancellationToken);
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
        for (var attempt = 0; attempt < 12; attempt++)
        {
            var code = GuestTokenService.GenerateJoinCode(_sessionOptions.Value.JoinCodeLength);
            if (!await _db.QuizSessions
                    .IgnoreQueryFilters()
                    .AnyAsync(item => item.JoinCode == code, cancellationToken))
            {
                return code;
            }
        }

        throw new ServiceResultException(
            "Conflict",
            "Could not allocate a unique activity code. Try again.");
    }

    private Guid RequireTenant() =>
        _tenantContext.IsResolved && _tenantContext.TenantId is { } id && id != Guid.Empty
            ? id
            : throw new ServiceResultException(
                "TenantContextMissing",
                "Active tenant context is required.");
}
