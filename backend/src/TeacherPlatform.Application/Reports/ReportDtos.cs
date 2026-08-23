namespace TeacherPlatform.Application.Reports;

public sealed class SessionReportResponse
{
    public Guid SessionId { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? SessionLabel { get; set; }
    public string SessionStatus { get; set; } = string.Empty;

    /// <summary>نمط الجلسة — SelfPaced / Live / ProgressiveChallenge.</summary>
    public string SessionMode { get; set; } = string.Empty;
    public DateTime? ActivatedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public SessionReportSummaryResponse Summary { get; set; } = new();
    public IReadOnlyList<QuestionAnalyticsResponse> Questions { get; set; } = [];
}

public sealed class SessionReportSummaryResponse
{
    public int ParticipantCount { get; set; }
    public int AttemptCount { get; set; }
    public int CompletedCount { get; set; }
    public int InProgressCount { get; set; }
    public int TimedOutCount { get; set; }
    public int PassedCount { get; set; }
    public int FailedCount { get; set; }
    public decimal? AveragePercentage { get; set; }
    public long? AverageDurationMs { get; set; }
}

public sealed class QuestionAnalyticsResponse
{
    public Guid QuizVersionItemId { get; set; }
    public Guid QuestionVersionId { get; set; }
    public int SortOrder { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string QuestionType { get; set; } = string.Empty;
    public int Points { get; set; }
    public int AnswerCount { get; set; }
    public int CorrectCount { get; set; }
    public int IncorrectCount { get; set; }
    public decimal? SuccessPercentage { get; set; }
    public decimal? AverageScorePercentage { get; set; }
    public string DifficultySignal { get; set; } = string.Empty;
}

public sealed class AttemptListItemResponse
{
    public Guid AttemptId { get; set; }
    public Guid ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? Score { get; set; }
    public decimal? MaxScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }

    /// <summary>نمط الجلسة — SelfPaced / Live / ProgressiveChallenge.</summary>
    public string Mode { get; set; } = string.Empty;

    /// <summary>
    /// أعلى مستوى وصل إليه اللاعب في التحدي المتدرج (عدد الإجابات المسجلة)؛
    /// null في بقية الأنماط. إجمالي المستويات = عدد أسئلة النسخة المنشورة.
    /// </summary>
    public int? MaxLevelReached { get; set; }
    public long? DurationMs { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public sealed class AttemptDetailResponse
{
    public Guid AttemptId { get; set; }
    public Guid SessionId { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? SessionLabel { get; set; }
    public Guid ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? Score { get; set; }
    public decimal? MaxScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }

    /// <summary>نمط الجلسة — SelfPaced / Live / ProgressiveChallenge.</summary>
    public string Mode { get; set; } = string.Empty;

    /// <summary>أعلى مستوى وصل إليه اللاعب في التحدي المتدرج؛ null في بقية الأنماط.</summary>
    public int? MaxLevelReached { get; set; }

    /// <summary>إجمالي المستويات في التحدي المتدرج؛ null في بقية الأنماط.</summary>
    public int? TotalLevels { get; set; }
    public long? DurationMs { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public IReadOnlyList<AttemptQuestionResultResponse> Questions { get; set; } = [];
}

public sealed class AttemptQuestionResultResponse
{
    public Guid QuizVersionItemId { get; set; }
    public Guid QuestionVersionId { get; set; }
    public int SortOrder { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string QuestionType { get; set; } = string.Empty;
    public decimal PointsPossible { get; set; }
    public bool Answered { get; set; }
    public string? AnswerSummary { get; set; }
    public bool? IsCorrect { get; set; }
    public decimal? ScoreAwarded { get; set; }
    public DateTime? AnsweredAt { get; set; }
}
