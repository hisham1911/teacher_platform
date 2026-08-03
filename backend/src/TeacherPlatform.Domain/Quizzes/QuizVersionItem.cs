using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Quizzes;

/// <summary>
/// عنصر واحد داخل نسخة اختبار — يثبّت QuestionVersionId لحظة إضافته،
/// فتعديل السؤال المصدر لاحقًا لا يغيّر أي نسخة اختبار (مسودة أو منشورة).
/// القيود: (QuizVersionId, SortOrder) فريد، ولا تكرار لنفس السؤال داخل النسخة.
/// </summary>
public sealed class QuizVersionItem : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid QuizVersionId { get; set; }

    /// <summary>نسخة السؤال المثبتة — Immutable، تشير دائمًا لنفس المحتوى.</summary>
    public Guid QuestionVersionId { get; set; }

    public int SortOrder { get; set; }

    /// <summary>درجة السؤال — يجب أن تكون أكبر من صفر.</summary>
    public int Points { get; set; } = 1;

    public bool IsRequired { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public QuizVersion? QuizVersion { get; set; }

    public QuestionVersion? QuestionVersion { get; set; }
}
