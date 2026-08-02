using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Questions;

/// <summary>
/// سؤال داخل بنك أسئلة. كل تعديل للمحتوى ينشئ QuestionVersion جديدة؛
/// النسخ القديمة Immutable ولا تُحذف (مطلوبة من اختبارات منشورة سابقة).
/// RowVersion يفرض Optimistic Concurrency: التعديل المتزامن على نسخة قديمة يعيد 409.
/// </summary>
public sealed class Question : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid BankId { get; set; }

    public QuestionStatus Status { get; set; } = QuestionStatus.Active;

    public Guid? CurrentVersionId { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public QuestionBank? Bank { get; set; }

    public ICollection<QuestionVersion> Versions { get; set; } = new List<QuestionVersion>();

    public ICollection<QuestionTagLink> TagLinks { get; set; } = new List<QuestionTagLink>();
}

public enum QuestionStatus
{
    Active = 1,
    /// <summary>الأرشفة تخفي السؤال من القوائم الافتراضية لكنها لا تحذف تاريخه ولا نسخه.</summary>
    Archived = 2
}

public enum QuestionType
{
    MultipleChoice = 1,
    TrueFalse = 2,
    ShortAnswer = 3,
    Ordering = 4,
    Listening = 5
}
