using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Students;

/// <summary>
/// طالب مُدار داخل مساحة عمل واحدة.
/// StudentCode هو رمز roster قديم خفيف داخل مساحة العمل، بينما StudentPortalCredential
/// هو هوية الدخول الدائمة إلى بوابة الطالب وJoinCode يعرّف جلسة نشاط بعينها.
/// </summary>
public sealed class Student : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>رمز عشوائي غير متسلسل، فريد داخل مساحة العمل، ويُخزن بدون فواصل.</summary>
    public string StudentCode { get; set; } = string.Empty;

    public string? Grade { get; set; }

    public string? Notes { get; set; }

    /// <summary>إلغاء التفعيل يمنع كل دخول جديد للطالب دون حذف التاريخ والنتائج.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<SessionParticipant> Participants { get; set; } = new List<SessionParticipant>();
    public ICollection<StudentPortalCredential> PortalCredentials { get; set; } = new List<StudentPortalCredential>();
    public ICollection<StudentPortalSession> PortalSessions { get; set; } = new List<StudentPortalSession>();
}
