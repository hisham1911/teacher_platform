using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

/// <summary>
/// حدود استخدام مؤقتة على مستوى المستأجر لمنع الإساءة — تُفرض في السيرفر فقط
/// ولا يمكن تجاوزها من العميل. قابلة للإعداد بدون إعادة نشر.
/// </summary>
public sealed class QuizLimitOptions
{
    public const string SectionName = "QuizLimits";

    /// <summary>أقصى عدد اختبارات (غير مؤرشفة) لكل مستأجر.</summary>
    [Range(1, 100000)]
    public int MaxQuizzesPerTenant { get; set; } = 100;

    /// <summary>أقصى عدد أسئلة داخل اختبار واحد.</summary>
    [Range(1, 5000)]
    public int MaxQuestionsPerQuiz { get; set; } = 200;

    /// <summary>أقصى عدد اختبارات منشورة حاليًا لكل مستأجر.</summary>
    [Range(1, 100000)]
    public int MaxPublishedQuizzesPerTenant { get; set; } = 50;
}
