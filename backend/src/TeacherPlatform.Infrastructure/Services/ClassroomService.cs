using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Classrooms;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Classrooms;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class ClassroomService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly CommercialPolicyService _commercial;

    public ClassroomService(
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

    public async Task<IReadOnlyList<ClassroomResponse>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var query = _db.Classrooms.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(item => item.IsActive);
        }

        return await query
            .OrderByDescending(item => item.IsActive)
            .ThenBy(item => item.Name)
            .Select(item => new ClassroomResponse
            {
                Id = item.Id,
                Name = item.Name,
                AcademicYear = item.AcademicYear,
                IsActive = item.IsActive,
                StudentCount = item.Students.Count,
                Version = item.Version,
                CreatedAt = item.CreatedAt,
                UpdatedAt = item.UpdatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> GetAsync(
        Guid classroomId,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Classrooms.AsNoTracking()
            .Where(item => item.Id == classroomId)
            .Select(item => new ClassroomDetailResponse
            {
                Id = item.Id,
                Name = item.Name,
                AcademicYear = item.AcademicYear,
                IsActive = item.IsActive,
                StudentCount = item.Students.Count,
                Version = item.Version,
                CreatedAt = item.CreatedAt,
                UpdatedAt = item.UpdatedAt,
                Students = item.Students
                    .OrderBy(member => member.Student!.FullName)
                    .Select(member => new ClassroomStudentResponse
                    {
                        Id = member.StudentId,
                        FullName = member.Student!.FullName,
                        Grade = member.Student.Grade,
                        IsActive = member.Student.IsActive,
                        AddedAt = member.AddedAt
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<ClassroomDetailResponse> CreateAsync(
        CreateClassroomRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _commercial.AcquireCapacityLockAsync(
            tenantId,
            CommercialCapacity.Classes,
            cancellationToken);
        var activeCount = await _db.Classrooms.LongCountAsync(
            item => item.IsActive,
            cancellationToken);
        await _commercial.EnsureCapacityAsync(
            tenantId,
            CommercialCapacity.Classes,
            activeCount,
            cancellationToken);

        var now = _clock.UtcNow;
        var classroom = new Classroom
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            AcademicYear = NormalizeOptional(request.AcademicYear),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Classrooms.Add(classroom);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (await GetAsync(classroom.Id, cancellationToken))!;
    }

    public async Task<ClassroomDetailResponse?> UpdateAsync(
        Guid classroomId,
        UpdateClassroomRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(
            item => item.Id == classroomId,
            cancellationToken);
        if (classroom is null)
        {
            return null;
        }

        EnsureVersion(classroom, request.BaseVersion);
        classroom.Name = request.Name.Trim();
        classroom.AcademicYear = NormalizeOptional(request.AcademicYear);
        classroom.UpdatedAt = _clock.UtcNow;
        await SaveConcurrencyAsync(cancellationToken);
        return await GetAsync(classroomId, cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> SetActiveAsync(
        Guid classroomId,
        UpdateClassroomStatusRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(
            item => item.Id == classroomId,
            cancellationToken);
        if (classroom is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return null;
        }

        EnsureVersion(classroom, request.BaseVersion);
        if (!classroom.IsActive && request.IsActive)
        {
            await _commercial.AcquireCapacityLockAsync(
                tenantId,
                CommercialCapacity.Classes,
                cancellationToken);
            var activeCount = await _db.Classrooms.LongCountAsync(
                item => item.IsActive,
                cancellationToken);
            await _commercial.EnsureCapacityAsync(
                tenantId,
                CommercialCapacity.Classes,
                activeCount,
                cancellationToken);
        }

        classroom.IsActive = request.IsActive;
        classroom.UpdatedAt = _clock.UtcNow;
        await SaveConcurrencyAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await GetAsync(classroomId, cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> AddStudentAsync(
        Guid classroomId,
        Guid studentId,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(
            item => item.Id == classroomId,
            cancellationToken);
        if (classroom is null)
        {
            return null;
        }

        if (!classroom.IsActive)
        {
            throw new ServiceResultException("Conflict", "Inactive classroom cannot accept new students.");
        }

        var student = await _db.Students
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == studentId, cancellationToken);
        if (student is null)
        {
            throw new ServiceResultException("NotFound", "Student not found.");
        }

        if (!student.IsActive)
        {
            throw new ServiceResultException("Conflict", "Inactive student cannot be added to a classroom.");
        }

        var exists = await _db.ClassroomStudents.AnyAsync(
            item => item.ClassroomId == classroomId && item.StudentId == studentId,
            cancellationToken);
        if (!exists)
        {
            _db.ClassroomStudents.Add(new ClassroomStudent
            {
                ClassroomId = classroomId,
                StudentId = studentId,
                TenantId = tenantId,
                AddedAt = _clock.UtcNow
            });
            await _db.SaveChangesAsync(cancellationToken);
        }

        return await GetAsync(classroomId, cancellationToken);
    }

    public async Task<bool> RemoveStudentAsync(
        Guid classroomId,
        Guid studentId,
        CancellationToken cancellationToken)
    {
        RequireTenant();
        if (!await _db.Classrooms.AsNoTracking().AnyAsync(
                item => item.Id == classroomId,
                cancellationToken))
        {
            return false;
        }

        var membership = await _db.ClassroomStudents.SingleOrDefaultAsync(
            item => item.ClassroomId == classroomId && item.StudentId == studentId,
            cancellationToken);
        if (membership is not null)
        {
            _db.ClassroomStudents.Remove(membership);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    private Guid RequireTenant() =>
        _tenantContext.IsResolved && _tenantContext.TenantId is { } id && id != Guid.Empty
            ? id
            : throw new ServiceResultException(
                "TenantContextMissing",
                "Active tenant context is required.");

    private static void EnsureVersion(Classroom classroom, uint version)
    {
        if (classroom.Version != version)
        {
            throw new ServiceResultException(
                "Conflict",
                "The classroom was modified by someone else. Reload and try again.");
        }
    }

    private async Task SaveConcurrencyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ServiceResultException(
                "Conflict",
                "The classroom was modified by someone else. Reload and try again.");
        }
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
