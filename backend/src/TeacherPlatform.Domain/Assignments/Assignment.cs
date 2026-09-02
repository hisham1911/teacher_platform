using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Assignments;

/// <summary>
/// عقد إسناد ثابت لنسخة نشاط منشورة. QuizVersionId هو المحتوى الملزم؛ لا يُعاد ربط
/// التكليف تلقائيًا إذا نشر المعلم نسخة أحدث من النشاط.
/// </summary>
public sealed class Assignment : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid QuizVersionId { get; set; }

    /// <summary>
    /// جلسة SelfPaced داخلية واحدة للتكليف. ليست هي التكليف نفسه؛ وظيفتها فقط إعادة استخدام Player الحالي.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>null يعني متاح فور إنشاء التكليف.</summary>
    public DateTime? AvailableAt { get; set; }

    /// <summary>موعد إرشادي للطالب؛ لا يمسح النتيجة ولا يمنع استكمال محاولة بدأت قبل الموعد.</summary>
    public DateTime? DueAt { get; set; }

    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public QuizVersion? QuizVersion { get; set; }
    public QuizSession? Session { get; set; }
    public ICollection<AssignmentRecipient> Recipients { get; set; } = new List<AssignmentRecipient>();
}
