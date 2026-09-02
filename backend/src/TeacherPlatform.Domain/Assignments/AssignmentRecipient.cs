using TeacherPlatform.Domain.Classrooms;
using TeacherPlatform.Domain.Students;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Assignments;

/// <summary>
/// Snapshot فعلي لمستلم التكليف. إسناد فصل يُوسّع وقت الإنشاء إلى طالب/طلاب ثابتين،
/// وSourceClassroomId يحتفظ بمصدر الإسناد للعرض والتدقيق دون جعل العضوية ديناميكية.
/// </summary>
public sealed class AssignmentRecipient : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AssignmentId { get; set; }
    public Guid StudentId { get; set; }
    public Guid? SourceClassroomId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Assignment? Assignment { get; set; }
    public Student? Student { get; set; }
    public Classroom? SourceClassroom { get; set; }
}
