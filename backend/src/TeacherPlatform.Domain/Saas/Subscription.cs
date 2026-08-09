using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Saas;

public sealed class Subscription : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PlanId { get; set; }
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? PaymentProvider { get; set; }
    public string? ExternalReference { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Plan? Plan { get; set; }
}

public enum SubscriptionStatus
{
    Active = 1,
    Suspended = 2,
    Expired = 3,
    Cancelled = 4
}
