namespace TeacherPlatform.Application.Abstractions;

public record SystemInfoResponse(
    string Service,
    string Status,
    string ApiVersion,
    DateTime ServerTimeUtc);
