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

    public ClassroomService(AppDbContext db, ITenantContext tenantContext, IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
    }

    public async Task<IReadOnlyList<ClassroomResponse>> ListAsync(bool includeInactive, CancellationToken cancellationToken)
    {
        RequireTenant();
        var query = _db.Classrooms.AsNoTracking();
        if (!includeInactive) query = query.Where(x => x.IsActive);

        return await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Select(x => new ClassroomResponse
            {
                Id = x.Id,
                Name = x.Name,
                AcademicYear = x.AcademicYear,
                IsActive = x.IsActive,
                StudentCount = x.Students.Count,
                Version = x.Version,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> GetAsync(Guid classroomId, CancellationToken cancellationToken)
    {
        RequireTenant();
        return await _db.Classrooms.AsNoTracking()
            .Where(x => x.Id == classroomId)
            .Select(x => new ClassroomDetailResponse
            {
                Id = x.Id,
                Name = x.Name,
                AcademicYear = x.AcademicYear,
                IsActive = x.IsActive,
                StudentCount = x.Students.Count,
                Version = x.Version,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt,
                Students = x.Students
                    .OrderBy(m => m.Student!.FullName)
                    .Select(m => new ClassroomStudentResponse
                    {
                        Id = m.StudentId,
                        FullName = m.Student!.FullName,
                        Grade = m.Student.Grade,
                        IsActive = m.Student.IsActive,
                        AddedAt = m.AddedAt
                    }).ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<ClassroomDetailResponse> CreateAsync(CreateClassroomRequest request, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
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
        return (await GetAsync(classroom.Id, cancellationToken))!;
    }

    public async Task<ClassroomDetailResponse?> UpdateAsync(Guid classroomId, UpdateClassroomRequest request, CancellationToken cancellationToken)
    {
        RequireTenant();
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(x => x.Id == classroomId, cancellationToken);
        if (classroom is null) return null;
        EnsureVersion(classroom, request.BaseVersion);
        classroom.Name = request.Name.Trim();
        classroom.AcademicYear = NormalizeOptional(request.AcademicYear);
        classroom.UpdatedAt = _clock.UtcNow;
        await SaveConcurrencyAsync(cancellationToken);
        return await GetAsync(classroomId, cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> SetActiveAsync(Guid classroomId, UpdateClassroomStatusRequest request, CancellationToken cancellationToken)
    {
        RequireTenant();
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(x => x.Id == classroomId, cancellationToken);
        if (classroom is null) return null;
        EnsureVersion(classroom, request.BaseVersion);
        classroom.IsActive = request.IsActive;
        classroom.UpdatedAt = _clock.UtcNow;
        await SaveConcurrencyAsync(cancellationToken);
        return await GetAsync(classroomId, cancellationToken);
    }

    public async Task<ClassroomDetailResponse?> AddStudentAsync(Guid classroomId, Guid studentId, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var classroom = await _db.Classrooms.SingleOrDefaultAsync(x => x.Id == classroomId, cancellationToken);
        if (classroom is null) return null;
        if (!classroom.IsActive) throw new ServiceResultException("Conflict", "Inactive classroom cannot accept new students.");

        var student = await _db.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) throw new ServiceResultException("NotFound", "Student not found.");
        if (!student.IsActive) throw new ServiceResultException("Conflict", "Inactive student cannot be added to a classroom.");

        var exists = await _db.ClassroomStudents.AnyAsync(x => x.ClassroomId == classroomId && x.StudentId == studentId, cancellationToken);
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

    public async Task<bool> RemoveStudentAsync(Guid classroomId, Guid studentId, CancellationToken cancellationToken)
    {
        RequireTenant();
        if (!await _db.Classrooms.AsNoTracking().AnyAsync(x => x.Id == classroomId, cancellationToken)) return false;
        var membership = await _db.ClassroomStudents.SingleOrDefaultAsync(x => x.ClassroomId == classroomId && x.StudentId == studentId, cancellationToken);
        if (membership is not null)
        {
            _db.ClassroomStudents.Remove(membership);
            await _db.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    private Guid RequireTenant() => _tenantContext.IsResolved && _tenantContext.TenantId is { } id && id != Guid.Empty
        ? id
        : throw new ServiceResultException("TenantContextMissing", "Active tenant context is required.");

    private static void EnsureVersion(Classroom classroom, uint version)
    {
        if (classroom.Version != version) throw new ServiceResultException("Conflict", "The classroom was modified by someone else. Reload and try again.");
    }

    private async Task SaveConcurrencyAsync(CancellationToken cancellationToken)
    {
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ServiceResultException("Conflict", "The classroom was modified by someone else. Reload and try again."); }
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
