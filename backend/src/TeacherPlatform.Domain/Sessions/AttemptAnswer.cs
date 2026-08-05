using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// إجابة طالب على عنصر واحد في محاولة — فريدة لكل (AttemptId, QuizVersionItemId).
/// AnswerJson يخزّن الإجابة بصيغة JSON محددة حسب نوع السؤال.
/// IsCorrect و ScoreAwarded تُحسبان من الخادم عند التقديم أو الإنهاء.
/// </summary>
public sealed class AttemptAnswer : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid AttemptId { get; set; }

    /// <summary>عنصر الاختبار المُجاب عليه — يثبّت QuestionVersionId عبر QuizVersionItem.</summary>
    public Guid QuizVersionItemId { get; set; }

    /// <summary>الإجابة بصيغة JSON — تختلف حسب نوع السؤال.</summary>
    public string AnswerJson { get; set; } = string.Empty;

    /// <summary>هل الإجابة صحيحة — null إذا لم تُقيَّم بعد.</summary>
    public bool? IsCorrect { get; set; }

    /// <summary>الدرجة الممنوحة — قد تكون جزئية في Ordering.</summary>
    public decimal? ScoreAwarded { get; set; }

    /// <summary>وقت تقديم الإجابة.</summary>
    public DateTime AnsweredAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Attempt? Attempt { get; set; }
}
