using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Questions;

// ---------- Banks ----------

public sealed class QuestionBankResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int QuestionCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class CreateQuestionBankRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }
}

public sealed class UpdateQuestionBankRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }
}

// ---------- Tags ----------

public sealed class QuestionTagResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int QuestionCount { get; set; }
}

// ---------- Questions ----------

/// <summary>اختبارات قائمة الأسئلة فقط — بدون Options.</summary>
public sealed class QuestionListItemResponse
{
    public Guid Id { get; set; }
    public Guid BankId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public int CurrentVersionNumber { get; set; }
    public IReadOnlyList<string> Tags { get; set; } = [];
    public DateTime UpdatedAt { get; set; }
}

public sealed class PagedResponse<T>
{
    public IReadOnlyList<T> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
}

public sealed class QuestionDetailResponse
{
    public Guid Id { get; set; }
    public Guid BankId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int CurrentVersionNumber { get; set; }
    public IReadOnlyList<string> Tags { get; set; } = [];
    public QuestionVersionResponse CurrentVersion { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>اللازم لاستدعاء PUT المتزامن — قيمة PostgreSQL xmin.</summary>
    public uint Version { get; set; }
}

public sealed class QuestionVersionResponse
{
    public Guid Id { get; set; }
    public int VersionNumber { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string ConfigJson { get; set; } = "{}";
    public Guid? MediaAssetId { get; set; }
    public bool IsValid { get; set; }
    public IReadOnlyList<string> ValidationErrors { get; set; } = [];
    public IReadOnlyList<QuestionOptionResponse> Options { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public sealed class QuestionOptionResponse
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}

public sealed class QuestionVersionSummaryResponse
{
    public Guid Id { get; set; }
    public int VersionNumber { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>مدخل خيار واحد في طلبات الإنشاء/التعديل.</summary>
public sealed class QuestionOptionInput
{
    [Required, StringLength(500, MinimumLength = 1)]
    public string Text { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }
}

/// <summary>
/// إنشاء سؤال: ينشئ السؤال + Version رقم 1 في معاملة واحدة.
/// نوع `ShortAnswer` يأخذ acceptedAnswers ويجب أن يكون Options فارغًا.
/// </summary>
public sealed class CreateQuestionRequest
{
    [Required]
    public Guid BankId { get; set; }

    [Required, RegularExpression("MultipleChoice|TrueFalse|ShortAnswer|Ordering|Listening")]
    public string QuestionType { get; set; } = string.Empty;

    [Required, StringLength(2000, MinimumLength = 1)]
    public string Prompt { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Explanation { get; set; }

    [RegularExpression("Easy|Medium|Hard")]
    public string Difficulty { get; set; } = "Medium";

    [RegularExpression("ar|en")]
    public string Language { get; set; } = "ar";

    /// <summary>وسائط السؤال (صورة أو ملف صوتي لأسئلة الاستماع) — يجب أن تكون رُفعت مسبقًا عبر Media endpoint.</summary>
    public Guid? MediaAssetId { get; set; }

    /// <summary>أسماء وسوم موجودة أو جديدة — تُنشأ تلقائيًا عند الحاجة. حد أقصى 20 وسم.</summary>
    [MaxLength(20)]
    public string[] Tags { get; set; } = [];

    [MaxLength(10)]
    public QuestionOptionInput[] Options { get; set; } = [];

    /// <summary>الإجابات المقبولة لأسئلة ShortAnswer.</summary>
    [MaxLength(20)]
    public string[]? AcceptedAnswers { get; set; }
}

/// <summary>
/// تعديل محتوى سؤال: ينشئ Version جديدة. BaseVersion مطلوب — إن اختلف
/// عن Question.Version الحالية في قاعدة البيانات يعاد 409 Conflict.
/// </summary>
public sealed class CreateQuestionVersionRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Prompt { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Explanation { get; set; }

    [RegularExpression("Easy|Medium|Hard")]
    public string Difficulty { get; set; } = "Medium";

    [RegularExpression("ar|en")]
    public string Language { get; set; } = "ar";

    public Guid? MediaAssetId { get; set; }

    [MaxLength(20)]
    public string[] Tags { get; set; } = [];

    [MaxLength(10)]
    public QuestionOptionInput[] Options { get; set; } = [];

    [MaxLength(20)]
    public string[]? AcceptedAnswers { get; set; }

    /// <summary>قيمة Question.Version التي قرأها العميل — مطلوبة للتزامن الآمن.</summary>
    [Required]
    public uint? BaseVersion { get; set; }
}
