using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Operations;

public sealed class OutboxMessage : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string MessageType { get; set; } = string.Empty;
    public Guid? AggregateId { get; set; }
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    public DateTime NextAttemptAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? LockedUntil { get; set; }
    public string? LockOwner { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
