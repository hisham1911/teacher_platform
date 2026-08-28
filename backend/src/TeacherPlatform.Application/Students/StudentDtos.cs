using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Students;

public sealed class StudentResponse
{
    public required Guid Id { get; init; }
    public required string FullName { get; init; }
    public required string StudentCode { get; init; }
    public string? Grade { get; init; }
    public string? Notes { get; init; }
    public required bool IsActive { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required DateTime UpdatedAt { get; init; }
}

public sealed class CreateStudentRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(50)]
    public string? Grade { get; init; }

    [StringLength(500)]
    public string? Notes { get; init; }
}

public sealed class UpdateStudentStatusRequest
{
    public bool IsActive { get; init; }
}

public sealed class StudentCodeJoinRequest
{
    [Required, StringLength(12, MinimumLength = 4)]
    public string StudentCode { get; init; } = string.Empty;
}

public sealed record StudentIdentity(Guid Id, Guid TenantId, string FullName, string StudentCode);
