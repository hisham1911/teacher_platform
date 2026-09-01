using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Students;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record StudentPortalLoginResult(StudentPortalProfileResponse Profile, string RawSessionToken, DateTime ExpiresAt);

/// <summary>
/// هوية الطالب الدائمة مستقلة عن أي QuizSession.
/// لا يعتمد هذا المسار على JWT المعلم ولا على Guest Token الخاص بالنشاط.
/// </summary>
public sealed class StudentPortalService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly ITenantContext _readTenantContext;
    private readonly IPasswordHasher<StudentPortalCredential> _passwordHasher;
    private readonly IOptions<StudentPortalOptions> _options;
    private readonly IClock _clock;

    public StudentPortalService(
        AppDbContext db,
        TenantContext tenantContext,
        ITenantContext readTenantContext,
        IPasswordHasher<StudentPortalCredential> passwordHasher,
        IOptions<StudentPortalOptions> options,
        IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _readTenantContext = readTenantContext;
        _passwordHasher = passwordHasher;
        _options = options;
        _clock = clock;
    }

    public async Task<StudentPortalAccessStatusResponse> GetAccessStatusAsync(Guid studentId, CancellationToken cancellationToken)
    {
        RequireTenant();
        if (!await _db.Students.AsNoTracking().AnyAsync(student => student.Id == studentId, cancellationToken))
        {
            throw new ServiceResultException("NotFound", "Student not found.");
        }

        var credential = await _db.StudentPortalCredentials
            .AsNoTracking()
            .Where(item => item.StudentId == studentId && item.RevokedAt == null)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new { item.CodeSuffix, item.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);

        return new StudentPortalAccessStatusResponse
        {
            HasAccessCode = credential is not null,
            CodeSuffix = credential?.CodeSuffix,
            CreatedAt = credential?.CreatedAt
        };
    }

    public async Task<StudentPortalAccessCodeResponse> RotateAccessCodeAsync(Guid studentId, CancellationToken cancellationToken)
    {
        EnsureEnabled();
        var tenantId = RequireTenant();
        var student = await _db.Students.SingleOrDefaultAsync(item => item.Id == studentId, cancellationToken)
            ?? throw new ServiceResultException("NotFound", "Student not found.");

        var now = _clock.UtcNow;
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var oldCredentials = await _db.StudentPortalCredentials
            .Where(item => item.StudentId == studentId && item.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var old in oldCredentials) old.RevokedAt = now;

        var oldSessions = await _db.StudentPortalSessions
            .Where(item => item.StudentId == studentId && item.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in oldSessions) session.RevokedAt = now;

        if (oldCredentials.Count > 0 || oldSessions.Count > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }

        var normalizedCode = await GenerateUniqueCodeAsync(cancellationToken);
        var credential = new StudentPortalCredential
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StudentId = student.Id,
            LookupDigest = StudentPortalCodeService.ComputeLookupDigest(normalizedCode),
            CodeSuffix = normalizedCode[^4..],
            CreatedAt = now
        };
        credential.VerifierHash = _passwordHasher.HashPassword(credential, normalizedCode);
        _db.StudentPortalCredentials.Add(credential);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new StudentPortalAccessCodeResponse
        {
            StudentId = student.Id,
            AccessCode = StudentPortalCodeService.Format(normalizedCode),
            CodeSuffix = credential.CodeSuffix,
            CreatedAt = credential.CreatedAt
        };
    }

    public async Task RevokeAccessAsync(Guid studentId, CancellationToken cancellationToken)
    {
        RequireTenant();
        if (!await _db.Students.AsNoTracking().AnyAsync(student => student.Id == studentId, cancellationToken))
        {
            throw new ServiceResultException("NotFound", "Student not found.");
        }

        var now = _clock.UtcNow;
        var credentials = await _db.StudentPortalCredentials
            .Where(item => item.StudentId == studentId && item.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var credential in credentials) credential.RevokedAt = now;

        var sessions = await _db.StudentPortalSessions
            .Where(item => item.StudentId == studentId && item.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions) session.RevokedAt = now;

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<StudentPortalLoginResult> LoginAsync(string accessCode, CancellationToken cancellationToken)
    {
        EnsureEnabled();
        var normalized = StudentPortalCodeService.Normalize(accessCode);
        if (normalized.Length < 12)
        {
            throw InvalidCredential();
        }

        var digest = StudentPortalCodeService.ComputeLookupDigest(normalized);
        var record = await (
            from credential in _db.StudentPortalCredentials.IgnoreQueryFilters().AsNoTracking()
            join student in _db.Students.IgnoreQueryFilters().AsNoTracking()
                on new { credential.StudentId, credential.TenantId } equals new { StudentId = student.Id, student.TenantId }
            join tenant in _db.Tenants.AsNoTracking() on credential.TenantId equals tenant.Id
            where credential.LookupDigest == digest
            select new { Credential = credential, Student = student, Tenant = tenant })
            .SingleOrDefaultAsync(cancellationToken);

        if (record is null || record.Credential.RevokedAt is not null || !record.Student.IsActive || record.Tenant.Status != TenantStatus.Active)
        {
            throw InvalidCredential();
        }

        var verified = _passwordHasher.VerifyHashedPassword(record.Credential, record.Credential.VerifierHash, normalized);
        if (verified == PasswordVerificationResult.Failed)
        {
            throw InvalidCredential();
        }

        var rawToken = StudentPortalTokenService.GenerateRawToken();
        var now = _clock.UtcNow;
        var expiresAt = now.AddDays(_options.Value.SessionDays);

        using (_tenantContext.BeginBootstrap(record.Student.TenantId))
        {
            _db.StudentPortalSessions.Add(new StudentPortalSession
            {
                Id = Guid.NewGuid(),
                TenantId = record.Student.TenantId,
                StudentId = record.Student.Id,
                CredentialId = record.Credential.Id,
                TokenHash = StudentPortalTokenService.ComputeHash(rawToken),
                CreatedAt = now,
                LastSeenAt = now,
                ExpiresAt = expiresAt
            });
            await _db.SaveChangesAsync(cancellationToken);
        }

        return new StudentPortalLoginResult(
            new StudentPortalProfileResponse
            {
                StudentId = record.Student.Id,
                TenantId = record.Student.TenantId,
                WorkspaceName = record.Tenant.Name,
                FullName = record.Student.FullName,
                Grade = record.Student.Grade
            },
            rawToken,
            expiresAt);
    }

    public async Task<StudentPortalProfileResponse> GetProfileAsync(string rawSessionToken, CancellationToken cancellationToken)
    {
        var resolved = await ResolveSessionAsync(rawSessionToken, cancellationToken);
        return new StudentPortalProfileResponse
        {
            StudentId = resolved.Identity.StudentId,
            TenantId = resolved.Identity.TenantId,
            WorkspaceName = resolved.WorkspaceName,
            FullName = resolved.Identity.FullName,
            Grade = resolved.Identity.Grade
        };
    }

    public async Task<StudentPortalIdentity> ResolveIdentityAsync(string rawSessionToken, CancellationToken cancellationToken) =>
        (await ResolveSessionAsync(rawSessionToken, cancellationToken)).Identity;

    public async Task<StudentPortalHomeResponse> GetHomeAsync(string rawSessionToken, CancellationToken cancellationToken)
    {
        var resolved = await ResolveSessionAsync(rawSessionToken, cancellationToken);
        using var tenantScope = _tenantContext.BeginBootstrap(resolved.Identity.TenantId);

        var activities = await _db.Attempts
            .AsNoTracking()
            .Where(attempt => attempt.Participant != null && attempt.Participant.StudentId == resolved.Identity.StudentId)
            .OrderByDescending(attempt => attempt.StartedAt)
            .Take(20)
            .Select(attempt => new StudentPortalActivityResponse
            {
                AttemptId = attempt.Id,
                SessionId = attempt.SessionId,
                JoinCode = attempt.Session != null ? attempt.Session.JoinCode : string.Empty,
                QuizTitle = attempt.Session != null && attempt.Session.Quiz != null ? attempt.Session.Quiz.Title : string.Empty,
                Mode = attempt.Session != null ? attempt.Session.Mode.ToString() : string.Empty,
                Status = attempt.Status.ToString(),
                Percentage = attempt.Percentage,
                Passed = attempt.Passed,
                StartedAt = attempt.StartedAt,
                FinishedAt = attempt.FinishedAt,
                CanResume = attempt.Status == AttemptStatus.InProgress && attempt.Session != null && attempt.Session.Status == SessionStatus.Active
            })
            .ToListAsync(cancellationToken);

        var completed = activities.Where(item => item.Status is "Finished" or "TimedOut").ToList();
        var percentages = completed.Where(item => item.Percentage.HasValue).Select(item => item.Percentage!.Value).ToList();
        var certificateCount = await _db.Certificates
            .AsNoTracking()
            .CountAsync(certificate =>
                certificate.Status == CertificateStatus.Ready &&
                certificate.Attempt != null &&
                certificate.Attempt.Participant != null &&
                certificate.Attempt.Participant.StudentId == resolved.Identity.StudentId,
                cancellationToken);

        return new StudentPortalHomeResponse
        {
            Profile = new StudentPortalProfileResponse
            {
                StudentId = resolved.Identity.StudentId,
                TenantId = resolved.Identity.TenantId,
                WorkspaceName = resolved.WorkspaceName,
                FullName = resolved.Identity.FullName,
                Grade = resolved.Identity.Grade
            },
            Summary = new StudentPortalSummaryResponse
            {
                CompletedActivities = completed.Count,
                AveragePercentage = percentages.Count == 0 ? null : Math.Round(percentages.Average(), 1),
                Certificates = certificateCount
            },
            ContinueActivity = activities.FirstOrDefault(item => item.CanResume),
            RecentActivities = activities.Take(8).ToList()
        };
    }

    public async Task LogoutAsync(string? rawSessionToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawSessionToken)) return;
        var hash = StudentPortalTokenService.ComputeHash(rawSessionToken);
        var session = await _db.StudentPortalSessions
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.TokenHash == hash && item.RevokedAt == null, cancellationToken);
        if (session is null) return;

        using var tenantScope = _tenantContext.BeginBootstrap(session.TenantId);
        session.RevokedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<ResolvedPortalSession> ResolveSessionAsync(string rawSessionToken, CancellationToken cancellationToken)
    {
        EnsureEnabled();
        if (string.IsNullOrWhiteSpace(rawSessionToken)) throw InvalidSession();
        var hash = StudentPortalTokenService.ComputeHash(rawSessionToken);
        var now = _clock.UtcNow;

        var record = await (
            from portalSession in _db.StudentPortalSessions.IgnoreQueryFilters()
            join credential in _db.StudentPortalCredentials.IgnoreQueryFilters()
                on new { portalSession.CredentialId, portalSession.TenantId } equals new { CredentialId = credential.Id, credential.TenantId }
            join student in _db.Students.IgnoreQueryFilters()
                on new { portalSession.StudentId, portalSession.TenantId } equals new { StudentId = student.Id, student.TenantId }
            join tenant in _db.Tenants on portalSession.TenantId equals tenant.Id
            where portalSession.TokenHash == hash
            select new { Session = portalSession, Credential = credential, Student = student, Tenant = tenant })
            .SingleOrDefaultAsync(cancellationToken);

        if (record is null ||
            record.Session.RevokedAt is not null ||
            record.Session.ExpiresAt <= now ||
            record.Credential.RevokedAt is not null ||
            !record.Student.IsActive ||
            record.Tenant.Status != TenantStatus.Active ||
            !StudentPortalTokenService.Verify(rawSessionToken, record.Session.TokenHash))
        {
            throw InvalidSession();
        }

        if (record.Session.LastSeenAt < now.AddMinutes(-15))
        {
            using var tenantScope = _tenantContext.BeginBootstrap(record.Session.TenantId);
            record.Session.LastSeenAt = now;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return new ResolvedPortalSession(
            new StudentPortalIdentity(record.Student.Id, record.Student.TenantId, record.Student.FullName, record.Student.Grade),
            record.Tenant.Name);
    }

    private async Task<string> GenerateUniqueCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 8; attempt += 1)
        {
            var code = StudentPortalCodeService.Generate(_options.Value.AccessCodeLength);
            var digest = StudentPortalCodeService.ComputeLookupDigest(code);
            if (!await _db.StudentPortalCredentials.IgnoreQueryFilters().AsNoTracking()
                    .AnyAsync(item => item.LookupDigest == digest, cancellationToken))
            {
                return code;
            }
        }
        throw new ServiceResultException("Conflict", "Could not allocate a unique student access code. Try again.");
    }

    private Guid RequireTenant() => _readTenantContext.IsResolved && _readTenantContext.TenantId is { } tenantId && tenantId != Guid.Empty
        ? tenantId
        : throw new ServiceResultException("TenantContextMissing", "Active tenant context is required.");

    private void EnsureEnabled()
    {
        if (!_options.Value.Enabled)
        {
            throw new ServiceResultException("NotFound", "Student portal is not available.");
        }
    }

    private static ServiceResultException InvalidCredential() =>
        new("Unauthorized", "Invalid student access code.");

    private static ServiceResultException InvalidSession() =>
        new("Unauthorized", "Student portal session is invalid or expired.");

    private sealed record ResolvedPortalSession(StudentPortalIdentity Identity, string WorkspaceName);
}
