using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Quizzes;

// ---------- Quiz CRUD ----------

public sealed class QuizListItemResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CurrentPublishedVersionNumber { get; set; }
    public int ItemCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class QuizDetailResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid? CurrentDraftVersionId { get; set; }
    public Guid? CurrentPublishedVersionId { get; set; }
    public int? CurrentPublishedVersionNumber { get; set; }
    public string PublicCode { get; set; } = string.Empty;
    public Guid? SubjectId { get; set; }
    public Guid? GradeId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>قيمة PostgreSQL xmin — لازمة لاستدعاءات التعديل المتزامنة.</summary>
    public uint Version { get; set; }
}

public sealed class CreateQuizRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(120, MinimumLength = 1)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$", ErrorMessage = "Slug must be lowercase alphanumeric with hyphens.")]
    public string Slug { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    public Guid? SubjectId { get; set; }

    public Guid? GradeId { get; set; }
}

public sealed class UpdateQuizRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(120, MinimumLength = 1)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$", ErrorMessage = "Slug must be lowercase alphanumeric with hyphens.")]
    public string Slug { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    public Guid? SubjectId { get; set; }

    public Guid? GradeId { get; set; }

    /// <summary>Optimistic concurrency — قيمة xmin المقروءة عند الجلب.</summary>
    [Required]
    public uint BaseVersion { get; set; }
}

// ---------- Draft editing ----------

/// <summary>Theme آمن: قالب من قائمة مسموحة + ألوان فقط — لا CSS/HTML/JS خام.</summary>
public sealed class QuizThemeInput
{
    [Required, StringLength(40, MinimumLength = 1)]
    public string Template { get; set; } = "default";

    [Required, RegularExpression("^#[0-9a-fA-F]{6}$", ErrorMessage = "Must be a hex color like #1a2b3c.")]
    public string PrimaryColor { get; set; } = "#2563eb";

    [Required, RegularExpression("^#[0-9a-fA-F]{6}$")]
    public string SecondaryColor { get; set; } = "#7c3aed";

    [Required, RegularExpression("^#[0-9a-fA-F]{6}$")]
    public string BackgroundColor { get; set; } = "#ffffff";
}

public sealed class UpdateDraftRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [StringLength(4000)]
    public string? Instructions { get; set; }

    [Range(0, 100)]
    public int PassingPercentage { get; set; } = 50;

    /// <summary>None | TotalTime | PerQuestion</summary>
    [Required, RegularExpression("None|TotalTime|PerQuestion")]
    public string TimeMode { get; set; } = "None";

    /// <summary>مطلوب عندما TimeMode != None.</summary>
    [Range(1, 86400)]
    public int? TimeLimitSeconds { get; set; }

    public bool ShuffleQuestions { get; set; }

    public bool ShuffleOptions { get; set; }

    [Required]
    public QuizThemeInput Theme { get; set; } = new();

    /// <summary>Optimistic concurrency على مسودة النسخة (xmin).</summary>
    [Required]
    public uint BaseVersion { get; set; }
}

public sealed class AddQuizItemRequest
{
    [Required]
    public Guid QuestionId { get; set; }

    [Range(1, 1000)]
    public int Points { get; set; } = 1;

    public bool IsRequired { get; set; } = true;
}

public sealed class UpdateQuizItemRequest
{
    [Range(1, 1000)]
    public int Points { get; set; }

    public bool IsRequired { get; set; }
}

public sealed class ReorderItemsRequest
{
    /// <summary>معرفات العناصر بالترتيب الجديد — يجب أن تطابق كل عناصر المسودة تمامًا.</summary>
    [Required, MinLength(1)]
    public IReadOnlyList<Guid> OrderedItemIds { get; set; } = [];
}

/// <summary>
/// طلب تحديث عنصر مسودة ليستخدم أحدث نسخة من السؤال المصدر (GAP-C).
/// يتطلب BaseVersion (xmin للمسودة) لكشف التعديل المتزامن — mismatch ⇒ 409.
/// </summary>
public sealed class UseLatestQuestionVersionRequest
{
    /// <summary>Optimistic concurrency على المسودة الحاوية للعنصر (xmin).</summary>
    [Required]
    public uint BaseVersion { get; set; }
}

// ---------- Draft / Preview / Versions ----------

public sealed class QuizDraftItemResponse
{
    public Guid Id { get; set; }
    public Guid QuestionVersionId { get; set; }
    public Guid QuestionId { get; set; }
    public int SortOrder { get; set; }
    public int Points { get; set; }
    public bool IsRequired { get; set; }

    // لقطة من نسخة السؤال المثبتة
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string ConfigJson { get; set; } = "{}";
    public Guid? MediaAssetId { get; set; }
    public IReadOnlyList<QuizDraftItemOptionResponse> Options { get; set; } = [];

    /// <summary>رقم أحدث نسخة من السؤال المصدر — إن كان أكبر من المثبت يظهر تنبيه "توجد نسخة أحدث".</summary>
    public int PinnedVersionNumber { get; set; }

    public int LatestVersionNumber { get; set; }

    public bool SourceQuestionArchived { get; set; }
}

public sealed class QuizDraftItemOptionResponse
{
    public int SortOrder { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}

public sealed class QuizDraftResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public int VersionNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public int PassingPercentage { get; set; }
    public string TimeMode { get; set; } = string.Empty;
    public int? TimeLimitSeconds { get; set; }
    public bool ShuffleQuestions { get; set; }
    public bool ShuffleOptions { get; set; }
    public QuizThemeInput Theme { get; set; } = new();
    public IReadOnlyList<QuizDraftItemResponse> Items { get; set; } = [];
    public int TotalPoints { get; set; }

    /// <summary>قيمة xmin للمسودة — لازمة لكل عمليات التعديل.</summary>
    public uint Version { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public sealed class QuizVersionSummaryResponse
{
    public Guid Id { get; set; }
    public int VersionNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int ItemCount { get; set; }
    public int TotalPoints { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? Checksum { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>نسخة منشورة كاملة — للمعاينة والعرض. Immutable.</summary>
public sealed class QuizPublishedVersionResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public int VersionNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public int PassingPercentage { get; set; }
    public string TimeMode { get; set; } = string.Empty;
    public int? TimeLimitSeconds { get; set; }
    public bool ShuffleQuestions { get; set; }
    public bool ShuffleOptions { get; set; }
    public QuizThemeInput Theme { get; set; } = new();
    public IReadOnlyList<QuizDraftItemResponse> Items { get; set; } = [];
    public int TotalPoints { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? Checksum { get; set; }
}

// ---------- Publish & Share ----------

public sealed class PublishQuizRequest
{
    /// <summary>Optimistic concurrency على المسودة المطلوب نشرها (xmin).</summary>
    [Required]
    public uint BaseVersion { get; set; }
}

public sealed class PublishQuizResponse
{
    public Guid QuizId { get; set; }
    public Guid PublishedVersionId { get; set; }
    public int VersionNumber { get; set; }
    public DateTime PublishedAt { get; set; }
    public string Checksum { get; set; } = string.Empty;
    public string PublicCode { get; set; } = string.Empty;
    public string ShareUrl { get; set; } = string.Empty;
}

public sealed class QuizShareResponse
{
    public Guid QuizId { get; set; }
    public string PublicCode { get; set; } = string.Empty;
    public string ShareUrl { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? PublishedVersionNumber { get; set; }
}

// ---------- Public (anonymous) ----------

/// <summary>
/// بيانات الصفحة العامة الآمنة فقط — لا أسئلة ولا إجابات ولا درجات ولا تفاصيل مستأجر داخلية.
/// </summary>
public sealed class PublicQuizPageResponse
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public int PassingPercentage { get; set; }
    public string TimeMode { get; set; } = string.Empty;
    public int? TimeLimitSeconds { get; set; }
    public int QuestionCount { get; set; }
    public int TotalPoints { get; set; }
    public QuizThemeInput Theme { get; set; } = new();
    public bool Available { get; set; }
}
