using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Assignments;

public sealed class CreateAssignmentRequest
{
    public Guid QuizVersionId { get; init; }
    public IReadOnlyList<Guid> ClassroomIds { get; init; } = [];
    public IReadOnlyList<Guid> StudentIds { get; init; } = [];
    public DateTime? AvailableAt { get; init; }
    public DateTime? DueAt { get; init; }
}

public sealed class AssignmentRecipientResponse
{
    public Guid StudentId { get; init; }
    public string StudentName { get; init; } = string.Empty;
    public Guid? SourceClassroomId { get; init; }
    public string? SourceClassroomName { get; init; }
}

public sealed class AssignmentResponse
{
    public Guid Id { get; init; }
    public Guid QuizVersionId { get; init; }
    public Guid QuizId { get; init; }
    public string ActivityTitle { get; init; } = string.Empty;
    public DateTime? AvailableAt { get; init; }
    public DateTime? DueAt { get; init; }
    public int RecipientCount { get; init; }
    public int StartedCount { get; init; }
    public int CompletedCount { get; init; }
    public uint Version { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AssignmentDetailResponse : AssignmentResponse
{
    public IReadOnlyList<AssignmentRecipientResponse> Recipients { get; init; } = [];
}

public sealed class StudentTaskResponse
{
    public Guid Id { get; init; }
    public string ActivityTitle { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public DateTime? AvailableAt { get; init; }
    public DateTime? DueAt { get; init; }
    public decimal ProgressPercentage { get; init; }
    public decimal? Score { get; init; }
    public decimal? MaxScore { get; init; }
    public decimal? ResultPercentage { get; init; }
    public bool? Passed { get; init; }
    public Guid? CertificateId { get; init; }
}

public sealed class StartStudentTaskResponse
{
    public Guid AssignmentId { get; init; }
    public string JoinCode { get; init; } = string.Empty;
    public Guid ParticipantId { get; init; }
    public Guid? AttemptId { get; init; }
    public string? AttemptStatus { get; init; }
}
