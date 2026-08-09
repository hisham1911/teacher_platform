using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Saas;

public sealed class ReferralCode : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public ICollection<ReferralEvent> Events { get; set; } = new List<ReferralEvent>();
}

public sealed class ReferralEvent : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ReferralCodeId { get; set; }
    public Guid? ReferredTenantId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    public ReferralCode? ReferralCode { get; set; }
}
