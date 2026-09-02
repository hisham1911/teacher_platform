using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Students;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class StudentService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly CommercialPolicyService _commercial;

    public StudentService(
        AppDbContext db,
        ITenantContext tenantContext,
        IClock clock,
        CommercialPolicyService commercial)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
        _commercial = commercial;
    }

    public async Task<IReadOnlyList<StudentResponse>> ListAsync(
        string? search,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        var query = _db.Students.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(student => student.IsActive);
        }

        if (normalizedSearch is not null)
        {
            var normalizedCode = StudentCodeGenerator.Normalize(normalizedSearch);
            query = query.Where(student =>
                EF.Functions.ILike(student.FullName, $"%{normalizedSearch}%") ||
                (normalizedCode.Length > 0 && EF.Functions.ILike(student.StudentCode, $"%{normalizedCode}%")));
        }

        var students = await query
            .OrderByDescending(student => student.IsActive)
            .ThenBy(student => student.FullName)
            .ThenBy(student => student.CreatedAt)
            .ToListAsync(cancellationToken);
        return students.Select(ToResponse).ToList();
    }

    public async Task<StudentResponse?> GetAsync(
        Guid studentId,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var student = await _db.Students
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == studentId, cancellationToken);
        return student is null ? null : ToResponse(student);
    }

    public async Task<StudentResponse> CreateAsync(
        CreateStudentRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _commercial.AcquireCapacityLockAsync(
            tenantId,
            CommercialCapacity.Students,
            cancellationToken);
        var activeStudents = await _db.Students.LongCountAsync(
            student => student.IsActive,
            cancellationToken);
        await _commercial.EnsureCapacityAsync(
            tenantId,
            CommercialCapacity.Students,
            activeStudents,
            cancellationToken);

        for (var attempt = 0; attempt < 8; attempt += 1)
        {
            var student = new Student
            {
                Id = Guid.NewGuid(),
                FullName = request.FullName.Trim(),
                StudentCode = StudentCodeGenerator.Generate(),
                Grade = NormalizeOptional(request.Grade),
                Notes = NormalizeOptional(request.Notes),
                IsActive = true
            };
            _db.Students.Add(student);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return ToResponse(student);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception))
            {
                _db.Entry(student).State = EntityState.Detached;
            }
        }

        throw new ServiceResultException("Conflict", "Could not allocate a unique student code. Try again.");
    }

    public async Task<StudentResponse?> UpdateAsync(
        Guid studentId,
        UpdateStudentRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var student = await _db.Students.SingleOrDefaultAsync(
            item => item.Id == studentId,
            cancellationToken);
        if (student is null)
        {
            return null;
        }

        EnsureVersion(student, request.BaseVersion);
        student.FullName = request.FullName.Trim();
        student.Grade = NormalizeOptional(request.Grade);
        student.Notes = NormalizeOptional(request.Notes);
        await SaveWithConcurrencyAsync(cancellationToken);
        return ToResponse(student);
    }

    public async Task<StudentResponse?> SetActiveAsync(
        Guid studentId,
        UpdateStudentStatusRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var student = await _db.Students.SingleOrDefaultAsync(
            item => item.Id == studentId,
            cancellationToken);
        if (student is null)
        {
            return null;
        }

        EnsureVersion(student, request.BaseVersion);

        if (request.IsActive && !student.IsActive)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            await _commercial.AcquireCapacityLockAsync(
                tenantId,
                CommercialCapacity.Students,
                cancellationToken);
            var activeStudents = await _db.Students.LongCountAsync(
                item => item.IsActive,
                cancellationToken);
            await _commercial.EnsureCapacityAsync(
                tenantId,
                CommercialCapacity.Students,
                activeStudents,
                cancellationToken);
            student.IsActive = true;
            await SaveWithConcurrencyAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ToResponse(student);
        }

        student.IsActive = request.IsActive;
        if (!request.IsActive)
        {
            var now = _clock.UtcNow;
            var portalSessions = await _db.StudentPortalSessions
                .Where(item => item.StudentId == studentId && item.RevokedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var portalSession in portalSessions)
            {
                portalSession.RevokedAt = now;
            }
        }

        await SaveWithConcurrencyAsync(cancellationToken);
        return ToResponse(student);
    }

    public async Task<StudentResponse?> RegenerateCodeAsync(
        Guid studentId,
        RegenerateStudentCodeRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var student = await _db.Students.SingleOrDefaultAsync(
            item => item.Id == studentId,
            cancellationToken);
        if (student is null)
        {
            return null;
        }

        EnsureVersion(student, request.BaseVersion);
        for (var attempt = 0; attempt < 8; attempt += 1)
        {
            var code = StudentCodeGenerator.Generate();
            if (await _db.Students.AsNoTracking().AnyAsync(
                item => item.Id != studentId && item.StudentCode == code,
                cancellationToken))
            {
                continue;
            }

            student.StudentCode = code;
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(student);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception))
            {
                await _db.Entry(student).ReloadAsync(cancellationToken);
                EnsureVersion(student, request.BaseVersion);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw Conflict();
            }
        }

        throw new ServiceResultException("Conflict", "Could not allocate a unique student code. Try again.");
    }

    public async Task<IReadOnlyList<StudentResultResponse>> ListResultsAsync(
        Guid studentId,
        int take,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        if (!await _db.Students.AsNoTracking().AnyAsync(
            student => student.Id == studentId,
            cancellationToken))
        {
            throw new ServiceResultException("NotFound", "Student not found.");
        }

        var size = Math.Clamp(take, 1, 100);
        return await _db.Attempts
            .AsNoTracking()
            .Where(attempt => attempt.Participant != null && attempt.Participant.StudentId == studentId)
            .OrderByDescending(attempt => attempt.StartedAt)
            .Take(size)
            .Select(attempt => new StudentResultResponse
            {
                AttemptId = attempt.Id,
                SessionId = attempt.SessionId,
                QuizId = attempt.Session != null ? attempt.Session.QuizId : Guid.Empty,
                QuizTitle = attempt.Session != null && attempt.Session.Quiz != null
                    ? attempt.Session.Quiz.Title
                    : string.Empty,
                SessionLabel = attempt.Session != null ? attempt.Session.Label : null,
                Mode = attempt.Session != null ? attempt.Session.Mode.ToString() : string.Empty,
                Status = attempt.Status.ToString(),
                Score = attempt.Score,
                MaxScore = attempt.MaxScore,
                Percentage = attempt.Percentage,
                Passed = attempt.Passed,
                StartedAt = attempt.StartedAt,
                FinishedAt = attempt.FinishedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<StudentIdentity?> ResolveActiveByCodeAsync(
        Guid tenantId,
        string studentCode,
        CancellationToken cancellationToken)
    {
        var normalizedCode = StudentCodeGenerator.Normalize(studentCode);
        if (normalizedCode.Length < 4)
        {
            return null;
        }

        return await _db.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(student =>
                student.TenantId == tenantId
                && student.StudentCode == normalizedCode
                && student.IsActive)
            .Select(student => new StudentIdentity(
                student.Id,
                student.TenantId,
                student.FullName,
                student.StudentCode))
            .SingleOrDefaultAsync(cancellationToken);
    }

    private Guid RequireTenant() =>
        _tenantContext.IsResolved
        && _tenantContext.TenantId is { } tenantId
        && tenantId != Guid.Empty
            ? tenantId
            : throw new ServiceResultException(
                "TenantContextMissing",
                "Active tenant context is required.");

    private static StudentResponse ToResponse(Student student) => new()
    {
        Id = student.Id,
        FullName = student.FullName,
        StudentCode = student.StudentCode,
        Grade = student.Grade,
        Notes = student.Notes,
        IsActive = student.IsActive,
        Version = student.Version,
        CreatedAt = student.CreatedAt,
        UpdatedAt = student.UpdatedAt
    };

    private static void EnsureVersion(Student student, uint baseVersion)
    {
        if (student.Version != baseVersion)
        {
            throw Conflict();
        }
    }

    private async Task SaveWithConcurrencyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw Conflict();
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static ServiceResultException Conflict() =>
        new("Conflict", "The student was modified by someone else. Reload and try again.");

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
