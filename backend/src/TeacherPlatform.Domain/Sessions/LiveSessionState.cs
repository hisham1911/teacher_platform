using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// الحالة الخادمية الوحيدة للمسابقة المباشرة. SignalR ينقل snapshots منها ولا يملك حالة مستقلة.
/// </summary>
public sealed class LiveSessionState : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SessionId { get; set; }
    public LiveSessionPhase Phase { get; set; } = LiveSessionPhase.Lobby;
    public int CurrentQuestionIndex { get; set; } = -1;
    public Guid? CurrentQuizVersionItemId { get; set; }
    public DateTime? QuestionStartedAt { get; set; }
    public DateTime? QuestionClosesAt { get; set; }
    public int Revision { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public QuizSession? Session { get; set; }
    public QuizVersionItem? CurrentQuizVersionItem { get; set; }
}

public enum LiveSessionPhase
{
    Lobby = 1,
    QuestionOpen = 2,
    QuestionClosed = 3,
    Finished = 4
}
