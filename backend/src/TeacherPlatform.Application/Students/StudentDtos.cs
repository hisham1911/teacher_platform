using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Students;

public sealed class StudentResponse
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string StudentCode { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class CreateStudentRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    [StringLength(50)]
    public string? Grade { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }
}

public sealed class UpdateStudentRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    [StringLength(50)]
    public string? Grade { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }

    public uint BaseVersion { get; set; }
}

public sealed class UpdateStudentStatusRequest
{
    public bool IsActive { get; set; }
    public uint BaseVersion { get; set; }
}

public sealed class RegenerateStudentCodeRequest
{
    public uint BaseVersion { get; set; }
}

public sealed class StudentCodeJoinRequest
{
    [Required, StringLength(16, MinimumLength = 4)]
    public string StudentCode { get; set; } = string.Empty;
}

public sealed class StudentResultResponse
{
    public Guid AttemptId { get; set; }
    public Guid SessionId { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? SessionLabel { get; set; }
    public string Mode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? Score { get; set; }
    public decimal? MaxScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool? Passed { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public sealed record StudentIdentity(Guid Id, Guid TenantId, string FullName, string StudentCode);
