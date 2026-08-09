using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Certificates;

public sealed class ParentResultShare : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AttemptId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Attempt? Attempt { get; set; }
}
