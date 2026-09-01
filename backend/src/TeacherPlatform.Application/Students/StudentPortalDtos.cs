using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Students;

public sealed class StudentPortalLoginRequest
{
    [Required, StringLength(32, MinimumLength = 8)]
    public string AccessCode { get; set; } = string.Empty;
}

public sealed class StudentPortalProfileResponse
{
    public Guid StudentId { get; set; }
    public Guid TenantId { get; set; }
    public string WorkspaceName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Grade { get; set; }
}

public sealed class StudentPortalAccessStatusResponse
{
    public bool HasAccessCode { get; set; }
    public string? CodeSuffix { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public sealed class StudentPortalAccessCodeResponse
{
    public Guid StudentId { get; set; }
    public string AccessCode { get; set; } = string.Empty;
    public string CodeSuffix { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public sealed class StudentPortalSummaryResponse
{
    public int CompletedActivities { get; set; }
    public decimal? AveragePercentage { get; set; }
    public int Certificates { get; set; }
}

public sealed class StudentPortalActivityResponse
{
    public Guid AttemptId { get; set; }
    public Guid SessionId { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public string QuizTitle { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public bool CanResume { get; set; }
}

public sealed class StudentPortalHomeResponse
{
    public StudentPortalProfileResponse Profile { get; set; } = new();
    public StudentPortalSummaryResponse Summary { get; set; } = new();
    public StudentPortalActivityResponse? ContinueActivity { get; set; }
    public IReadOnlyList<StudentPortalActivityResponse> RecentActivities { get; set; } = [];
}

public sealed record StudentPortalIdentity(Guid StudentId, Guid TenantId, string FullName, string? Grade);
