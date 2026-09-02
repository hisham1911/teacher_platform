using TeacherPlatform.Domain.Students;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Classrooms;

/// <summary>
/// عضوية طالب في فصل. TenantId موجود صراحة حتى يمر الكيان بنفس global filter/save guard
/// ولا تعتمد العزلة على علاقة FK وحدها.
/// </summary>
public sealed class ClassroomStudent : ITenantEntity
{
    public Guid ClassroomId { get; set; }
    public Guid StudentId { get; set; }
    public Guid TenantId { get; set; }
    public DateTime AddedAt { get; set; }

    public Classroom? Classroom { get; set; }
    public Student? Student { get; set; }
}
