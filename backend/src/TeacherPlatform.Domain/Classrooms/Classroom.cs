using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Classrooms;

/// <summary>
/// مجموعة طلاب دائمة داخل مساحة عمل واحدة. الغرض في Phase 2 هو التجميع للإسناد فقط؛
/// لا تمثل جدول حصص أو حضورًا أو LMS course.
/// </summary>
public sealed class Classroom : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? AcademicYear { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<ClassroomStudent> Students { get; set; } = new List<ClassroomStudent>();
}
