namespace TeacherPlatform.Domain.Tenancy;

/// <summary>
/// عضوية مستخدم في مساحة عمل. القيد الفريد: (TenantId, UserId).
/// الأدوار هنا لا تتداخل مع الدور العالمي PlatformAdmin — ممنوع منحه عبر عضوية.
/// </summary>
public sealed class TenantMembership
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid UserId { get; set; }

    public TenantMemberRole Role { get; set; }

    public TenantMembershipStatus Status { get; set; } = TenantMembershipStatus.Active;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Tenant? Tenant { get; set; }
}

public enum TenantMemberRole
{
    Owner = 1,
    Teacher = 2,
    Assistant = 3,
    Viewer = 4
}

public enum TenantMembershipStatus
{
    Active = 1,
    Suspended = 2
}
