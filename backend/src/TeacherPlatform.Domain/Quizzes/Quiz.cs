using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Quizzes;

/// <summary>
/// اختبار داخل مساحة عمل. الهوية (Quiz) تحمل الحالة العامة والمؤشرات إلى
/// النسخة المسودة الحالية والنسخة المنشورة الحالية؛ المحتوى الفعلي يعيش في
/// QuizVersion. RowVersion (xmin) يفرض Optimistic Concurrency على التعديلات.
/// </summary>
public sealed class Quiz : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string Title { get; set; } = string.Empty;

    /// <summary>Slug كما اختاره المعلم (للعرض).</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>نسخة مطبّعة (lower + trimmed) — الفهرس الفريد عليها داخل المستأجر.</summary>
    public string NormalizedSlug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public QuizStatus Status { get; set; } = QuizStatus.Draft;

    /// <summary>النسخة المسودة الحالية القابلة للتعديل — تُنشأ تلقائيًا مع الاختبار وبعد كل نشر.</summary>
    public Guid? CurrentDraftVersionId { get; set; }

    /// <summary>آخر نسخة منشورة — لا تُعدَّل أبدًا بعد النشر.</summary>
    public Guid? CurrentPublishedVersionId { get; set; }

    /// <summary>
    /// رمز عام غير قابل للتخمين يُستخدم في رابط المشاركة العام.
    /// يُولَّد في السيرفر عند الإنشاء (Base64Url من 16 بايت عشوائية).
    /// </summary>
    public string PublicCode { get; set; } = string.Empty;

    /// <summary>تصنيفات اختيارية — تُربط لاحقًا بكيانات Metadata عند توفرها.</summary>
    public Guid? SubjectId { get; set; }

    public Guid? GradeId { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<QuizVersion> Versions { get; set; } = new List<QuizVersion>();
}

public enum QuizStatus
{
    Draft = 1,
    Published = 2,
    /// <summary>الأرشفة تخفي الاختبار من القوائم الافتراضية لكنها تحتفظ بكل النسخ.</summary>
    Archived = 3
}
