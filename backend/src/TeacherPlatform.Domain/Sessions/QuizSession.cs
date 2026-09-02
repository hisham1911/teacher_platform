using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// جلسة اختبار — تمثل إتاحة اختبار منشور للطلاب عبر رمز انضمام.
/// تثبّت QuizVersionId المنشورة لحظة الإنشاء فلا يتأثر المحتوى بتعديلات لاحقة.
/// يدعم SelfPaced وLive وProgressiveChallenge؛ حالة Live التفصيلية محفوظة في LiveSessionState،
/// أما ProgressiveChallenge فتشتق تقدم اللاعب من Attempt.CurrentQuestionIndex وAttemptAnswers بلا جداول إضافية.
/// </summary>
public sealed class QuizSession : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid QuizId { get; set; }
    public Guid QuizVersionId { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public Guid? LaunchRequestId { get; set; }

    /// <summary>
    /// Open يحافظ على Quick Join الحالي. ManagedAssignment يحجز الانضمام لمسار Assignment المصرّح فقط.
    /// </summary>
    public SessionAccessKind AccessKind { get; set; } = SessionAccessKind.Open;

    public SessionMode Mode { get; set; } = SessionMode.SelfPaced;
    public SessionStatus Status { get; set; } = SessionStatus.Scheduled;
    public string? Label { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Quiz? Quiz { get; set; }
    public QuizVersion? QuizVersion { get; set; }
    public ICollection<SessionParticipant> Participants { get; set; } = new List<SessionParticipant>();
    public ICollection<Attempt> Attempts { get; set; } = new List<Attempt>();
    public LiveSessionState? LiveState { get; set; }
}

public enum SessionAccessKind
{
    Open = 1,
    ManagedAssignment = 2
}

public enum SessionMode
{
    SelfPaced = 1,
    Live = 2,
    ProgressiveChallenge = 3
}

public enum SessionStatus
{
    Scheduled = 1,
    Active = 2,
    Finished = 3,
    Cancelled = 4
}
