using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Students;

/// <summary>
/// طالب مُدار داخل مساحة عمل واحدة.
/// StudentCode هو هوية دخول خفيفة ثابتة للطالب داخل مساحة العمل، بينما JoinCode يعرّف جلسة نشاط بعينها.
/// لا تُستخدم هذه الهوية بدل كوكي اللاعب؛ بعد التحقق من StudentCode يحصل اللاعب على Guest Token للجلسة كالمعتاد.
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

    /// <summary>إلغاء التفعيل يمنع استخدام الرمز في انضمامات جديدة دون حذف التاريخ والنتائج.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<SessionParticipant> Participants { get; set; } = new List<SessionParticipant>();
}
