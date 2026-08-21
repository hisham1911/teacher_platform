using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Sessions;

// ---------- Teacher: Session management ----------

public sealed class CreateSessionRequest
{
    /// <summary>SelfPaced أو Live أو ProgressiveChallenge.</summary>
    [Required, RegularExpression("SelfPaced|Live|ProgressiveChallenge")]
    public string Mode { get; set; } = "SelfPaced";

    [StringLength(200)]
    public string? Label { get; set; }
}

public sealed class SessionListItemResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string JoinCode { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Label { get; set; }
    public int ParticipantCount { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class SessionDetailResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public Guid QuizVersionId { get; set; }
    public int QuizVersionNumber { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Label { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>قيمة PostgreSQL xmin — لازمة لاستدعاءات التفعيل/الإنهاء/الإلغاء المتزامنة.</summary>
    public uint Version { get; set; }

    public IReadOnlyList<SessionParticipantResponse> Participants { get; set; } = [];
}

public sealed class SessionParticipantResponse
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
    public Guid? AttemptId { get; set; }
    public string? AttemptStatus { get; set; }
    public decimal? Score { get; set; }
    public decimal? MaxScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }
}

/// <summary>طلب تغيير حالة الجلسة — BaseVersion (xmin) لكشف التعديل المتزامن، mismatch ⇒ 409.</summary>
public sealed class SessionStateChangeRequest
{
    [Required]
    public uint BaseVersion { get; set; }
}

// ---------- Player: anonymous join & play ----------

/// <summary>
/// بيانات صفحة الانضمام العامة الآمنة — metadata فقط، لا أسئلة ولا خيارات ولا إجابات.
/// </summary>
public sealed class PlayerSessionResponse
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public int PassingPercentage { get; set; }
    public string TimeMode { get; set; } = string.Empty;
    public int? TimeLimitSeconds { get; set; }
    public int QuestionCount { get; set; }
    public int TotalPoints { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;

    /// <summary>هل يمكن الانضمام الآن (الجلسة Active).</summary>
    public bool CanJoin { get; set; }
}

public sealed class JoinSessionRequest
{
    [Required, StringLength(50, MinimumLength = 2)]
    public string DisplayName { get; set; } = string.Empty;
}

public sealed class JoinSessionResponse
{
    public Guid ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public Guid? AttemptId { get; set; }
    public string? AttemptStatus { get; set; }
}

public sealed class StartAttemptResponse
{
    public Guid AttemptId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? DeadlineAt { get; set; }

    /// <summary>وقت السيرفر الحالي — لمزامنة عدّاد العميل بدون الاعتماد على ساعة الجهاز.</summary>
    public DateTime ServerNow { get; set; }
    public int TotalQuestions { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// سؤال آمن للاعب — لا يحتوي IsCorrect ولا الإجابات المقبولة ولا أي بيانات تقييم.
/// </summary>
public sealed class PlayerQuestionResponse
{
    public Guid QuizVersionItemId { get; set; }
    public int Index { get; set; }
    public int TotalQuestions { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public int Points { get; set; }
    public bool IsRequired { get; set; }
    public Guid? MediaAssetId { get; set; }

    /// <summary>خيارات مخلوطة حسب ShuffleSeed — بدون IsCorrect.</summary>
    public IReadOnlyList<PlayerQuestionOptionResponse> Options { get; set; } = [];

    /// <summary>هل أجاب اللاعب على هذا السؤال مسبقًا (للاستئناف).</summary>
    public bool AlreadyAnswered { get; set; }

    public DateTime? DeadlineAt { get; set; }
    public DateTime ServerNow { get; set; }
}

public sealed class PlayerQuestionOptionResponse
{
    public Guid OptionId { get; set; }
    public string OptionText { get; set; } = string.Empty;
}

public sealed class SubmitAnswerRequest
{
    [Required]
    public Guid QuizVersionItemId { get; set; }

    /// <summary>
    /// حمولة الإجابة JSON حسب النوع:
    /// MultipleChoice/TrueFalse/Listening: {"optionId": "guid"}
    /// ShortAnswer: {"text": "..."}
    /// Ordering: {"orderedOptionIds": ["guid", ...]}
    /// </summary>
    [Required, StringLength(4000, MinimumLength = 2)]
    public string AnswerJson { get; set; } = string.Empty;
}

public sealed class SubmitAnswerResponse
{
    public Guid AttemptId { get; set; }
    public Guid QuizVersionItemId { get; set; }
    /// <summary>null في Live حتى لا تُكشف صحة الإجابة قبل إغلاق السؤال.</summary>
    public bool? IsCorrect { get; set; }
    /// <summary>null في Live حتى لا تُكشف الدرجة قبل إغلاق السؤال.</summary>
    public decimal? ScoreAwarded { get; set; }
    public int Revision { get; set; }
    public DateTime ServerNow { get; set; }
}

public sealed class FinishAttemptResponse
{
    public Guid AttemptId { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public decimal MaxScore { get; set; }
    public decimal Percentage { get; set; }
    public bool Passed { get; set; }
    public long DurationMs { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public sealed class AttemptResultResponse
{
    public Guid AttemptId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public decimal? Score { get; set; }
    public decimal? MaxScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }
    public long? DurationMs { get; set; }
    public int AnsweredCount { get; set; }
    public int TotalQuestions { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}
