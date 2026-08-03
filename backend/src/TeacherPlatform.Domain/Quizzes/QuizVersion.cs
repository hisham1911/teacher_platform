using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Quizzes;

/// <summary>
/// نسخة محتوى اختبار. المسودة (Draft) قابلة للتعديل؛ بمجرد النشر تصبح
/// Immutable إلى الأبد (Published ثم Retired عند نشر نسخة أحدث).
/// أي Attempt مستقبلي (Phase 4) يرتبط بـQuizVersionId وليس QuizId.
/// Checksum هو SHA-256 على التمثيل القانوني للمحتوى — يكشف أي عبث.
/// </summary>
public sealed class QuizVersion : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid QuizId { get; set; }

    public int VersionNumber { get; set; }

    public QuizVersionStatus Status { get; set; } = QuizVersionStatus.Draft;

    public string TitleSnapshot { get; set; } = string.Empty;

    public string? DescriptionSnapshot { get; set; }

    public string? InstructionsSnapshot { get; set; }

    /// <summary>نسبة النجاح 0–100.</summary>
    public int PassingPercentage { get; set; } = 50;

    /// <summary>وضع الوقت: بلا وقت / وقت إجمالي / وقت لكل سؤال.</summary>
    public QuizTimeMode TimeMode { get; set; } = QuizTimeMode.None;

    /// <summary>المدة بالثواني — مطلوبة عندما TimeMode != None.</summary>
    public int? TimeLimitSeconds { get; set; }

    public bool ShuffleQuestions { get; set; }

    public bool ShuffleOptions { get; set; }

    /// <summary>
    /// لقطة Theme آمنة (jsonb): قالب من قائمة مسموحة + ألوان أساسية/ثانوية/خلفية.
    /// لا يُقبل أي CSS/HTML/JS خام — يُبنى ويُتحقق منه في طبقة Application.
    /// </summary>
    public string ThemeJson { get; set; } = "{}";

    public DateTime? PublishedAt { get; set; }

    /// <summary>SHA-256 hex (64 حرفًا) على التمثيل القانوني — يُحسب عند النشر فقط.</summary>
    public string? Checksum { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL xmin) — يحمي تعديل المسودة.</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Quiz? Quiz { get; set; }

    public ICollection<QuizVersionItem> Items { get; set; } = new List<QuizVersionItem>();
}

public enum QuizVersionStatus
{
    Draft = 1,
    Published = 2,
    /// <summary>نسخة منشورة سابقة حلّت محلها نسخة أحدث — تبقى Immutable للمحاولات المرتبطة بها.</summary>
    Retired = 3
}

public enum QuizTimeMode
{
    None = 1,
    TotalTime = 2,
    PerQuestion = 3
}
