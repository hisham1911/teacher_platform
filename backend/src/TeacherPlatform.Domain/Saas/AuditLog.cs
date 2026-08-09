namespace TeacherPlatform.Domain.Saas;

public sealed class AuditLog
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public string? RequestId { get; set; }
    public DateTime CreatedAt { get; set; }
}
