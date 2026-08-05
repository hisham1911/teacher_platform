using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// محاولة طالب واحد في جلسة — فريدة لكل (SessionId, ParticipantId).
/// ShuffleSeed يضمن ترتيباً حتمياً (deterministic) لكل محاولة.
/// Revision يُستخدم للتحكم في التزامن عند تقديم الإجابات.
/// </summary>
public sealed class Attempt : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid SessionId { get; set; }

    public Guid ParticipantId { get; set; }

    /// <summary>بذرة الخلط الحتمي — تُولَّد عشوائياً عند بدء المحاولة.</summary>
    public int ShuffleSeed { get; set; }

    /// <summary>رقم مراجعة يتزايد مع كل إجابة — للتحكم في التزامن.</summary>
    public int Revision { get; set; }

    public AttemptStatus Status { get; set; } = AttemptStatus.InProgress;

    /// <summary>السؤال الحالي (ترتيبه في القائمة المخلوطة) — 0-based.</summary>
    public int CurrentQuestionIndex { get; set; }

    /// <summary>وقت بدء المحاولة — يُضبط من الخادم.</summary>
    public DateTime StartedAt { get; set; }

    /// <summary>الموعد النهائي المحسوب من الخادم — null إذا بلا وقت.</summary>
    public DateTime? DeadlineAt { get; set; }

    /// <summary>وقت الإنهاء الفعلي.</summary>
    public DateTime? FinishedAt { get; set; }

    /// <summary>المدة الفعلية بالمللي ثانية.</summary>
    public long? DurationMs { get; set; }

    /// <summary>الدرجة المحسوبة — تُملأ عند الإنهاء.</summary>
    public decimal? Score { get; set; }

    /// <summary>الدرجة القصوى الممكنة.</summary>
    public decimal? MaxScore { get; set; }

    /// <summary>النسبة المئوية (0–100).</summary>
    public decimal? Percentage { get; set; }

    /// <summary>هل نجح (Percentage >= PassingPercentage).</summary>
    public bool? Passed { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public QuizSession? Session { get; set; }

    public SessionParticipant? Participant { get; set; }

    public ICollection<AttemptAnswer> Answers { get; set; } = new List<AttemptAnswer>();
}

public enum AttemptStatus
{
    InProgress = 1,
    Finished = 2,
    /// <summary>انتهت المهلة — أُنهيت تلقائياً عند أول طلب بعد انتهاء الوقت.</summary>
    TimedOut = 3
}
