using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TeacherPlatform.Application.Live;

public static class LiveEventNames
{
    public const string LobbyUpdated = "LobbyUpdated";
    public const string SessionStarted = "SessionStarted";
    public const string QuestionOpened = "QuestionOpened";
    public const string QuestionClosed = "QuestionClosed";
    public const string LeaderboardUpdated = "LeaderboardUpdated";
    public const string SessionFinished = "SessionFinished";
    public const string LiveStateChanged = "LiveStateChanged";
}

public static class LiveTokenClaims
{
    public const string Role = "live_role";
    public const string TenantId = "tenant_id";
    public const string SessionId = "session_id";
    public const string ParticipantId = "participant_id";
    public const string Teacher = "teacher";
    public const string Player = "player";
}

public sealed class LiveControlRequest
{
    [Range(0, int.MaxValue)]
    public int BaseRevision { get; set; }

    [Range(5, 300)]
    public int? DurationSeconds { get; set; }
}

public sealed class LiveTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public sealed class LiveSessionStateResponse
{
    [JsonIgnore]
    public Guid InternalTenantId { get; set; }
    public Guid SessionId { get; set; }
    public string SessionStatus { get; set; } = string.Empty;
    public string Phase { get; set; } = string.Empty;
    public int CurrentQuestionIndex { get; set; }
    public int TotalQuestions { get; set; }
    public DateTime? QuestionStartedAt { get; set; }
    public DateTime? QuestionClosesAt { get; set; }
    public DateTime ServerNow { get; set; }
    public int Revision { get; set; }
    public int ParticipantCount { get; set; }
    public int AttemptCount { get; set; }
    public int AnsweredCount { get; set; }
    public LiveQuestionResponse? CurrentQuestion { get; set; }
    public IReadOnlyList<LiveLeaderboardEntryResponse> Leaderboard { get; set; } = [];
}

/// <summary>سؤال آمن للبث؛ لا يحتوي أي علامة للإجابة الصحيحة أو إعدادات التصحيح.</summary>
public sealed class LiveQuestionResponse
{
    public Guid QuizVersionItemId { get; set; }
    public int Index { get; set; }
    public int TotalQuestions { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public int Points { get; set; }
    public Guid? MediaAssetId { get; set; }
    public IReadOnlyList<LiveQuestionOptionResponse> Options { get; set; } = [];
}

public sealed class LiveQuestionOptionResponse
{
    public Guid OptionId { get; set; }
    public string OptionText { get; set; } = string.Empty;
}

public sealed class LiveLeaderboardEntryResponse
{
    public int Rank { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public int AnsweredCount { get; set; }
}
