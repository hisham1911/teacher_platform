using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Classrooms;

public sealed class CreateClassroomRequest
{
    [Required, StringLength(100, MinimumLength = 1), RegularExpression(@".*\S.*", ErrorMessage = "Name must contain at least one non-whitespace character.")]
    public string Name { get; init; } = string.Empty;
    [StringLength(30)] public string? AcademicYear { get; init; }
}

public sealed class UpdateClassroomRequest
{
    [Required, StringLength(100, MinimumLength = 1), RegularExpression(@".*\S.*", ErrorMessage = "Name must contain at least one non-whitespace character.")]
    public string Name { get; init; } = string.Empty;
    [StringLength(30)] public string? AcademicYear { get; init; }
    public uint BaseVersion { get; init; }
}

public sealed class UpdateClassroomStatusRequest
{
    public bool IsActive { get; init; }
    public uint BaseVersion { get; init; }
}

public sealed class ClassroomStudentRequest { public Guid StudentId { get; init; } }

public class ClassroomResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? AcademicYear { get; init; }
    public bool IsActive { get; init; }
    public int StudentCount { get; init; }
    public uint Version { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class ClassroomStudentResponse
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? Grade { get; init; }
    public bool IsActive { get; init; }
    public DateTime AddedAt { get; init; }
}

public sealed class ClassroomDetailResponse : ClassroomResponse
{
    public IReadOnlyList<ClassroomStudentResponse> Students { get; init; } = [];
}
