using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// جلسة اختبار — تمثل إتاحة اختبار منشور للطلاب عبر رمز انضمام.
/// تثبّت QuizVersionId المنشورة لحظة الإنشاء فلا يتأثر المحتوى بتعديلات لاحقة.
/// يدعم SelfPaced وLive؛ حالة Live التفصيلية محفوظة في LiveSessionState.
/// </summary>
public sealed class QuizSession : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>الاختبار الأم — للتنظيم والعرض فقط.</summary>
    public Guid QuizId { get; set; }

    /// <summary>نسخة الاختبار المنشورة المثبتة — المحتوى الفعلي للجلسة.</summary>
    public Guid QuizVersionId { get; set; }

    /// <summary>رمز الانضمام — عشوائي غير متسلسل، URL-safe، غير قابل للتخمين.</summary>
    public string JoinCode { get; set; } = string.Empty;

    public SessionMode Mode { get; set; } = SessionMode.SelfPaced;

    public SessionStatus Status { get; set; } = SessionStatus.Scheduled;

    /// <summary>عنوان وصفي اختياري للجلسة (مثل "حصة الأحد — مجموعة أ").</summary>
    public string? Label { get; set; }

    /// <summary>وقت التفعيل الفعلي — يُضبط عند الانتقال إلى Active.</summary>
    public DateTime? ActivatedAt { get; set; }

    /// <summary>وقت الإنهاء الفعلي — يُضبط عند الإنهاء أو الإلغاء.</summary>
    public DateTime? FinishedAt { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL xmin).</summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Quiz? Quiz { get; set; }

    public QuizVersion? QuizVersion { get; set; }

    public ICollection<SessionParticipant> Participants { get; set; } = new List<SessionParticipant>();

    public ICollection<Attempt> Attempts { get; set; } = new List<Attempt>();

    public LiveSessionState? LiveState { get; set; }
}

public enum SessionMode
{
    SelfPaced = 1,
    Live = 2
}

public enum SessionStatus
{
    /// <summary>أُنشئت لكن لم تُفعَّل بعد — لا يمكن الانضمام.</summary>
    Scheduled = 1,

    /// <summary>مفعّلة — يمكن الانضمام والإجابة.</summary>
    Active = 2,

    /// <summary>أُنهيت — لا مزيد من الإجابات، النتائج متاحة.</summary>
    Finished = 3,

    /// <summary>أُلغيت — لا نتائج ولا استئناف.</summary>
    Cancelled = 4
}
