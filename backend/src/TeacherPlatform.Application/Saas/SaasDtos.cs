using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Saas;

public sealed class PlanLimitsDto
{
    [Range(1, 100_000)] public int MaxQuizzesPerTenant { get; set; } = 100;
    [Range(1, 10_000)] public int MaxQuestionsPerQuiz { get; set; } = 200;
    [Range(1, 100_000)] public int MaxPublishedQuizzesPerTenant { get; set; } = 50;
    [Range(1, 10_000_000)] public int MaxAttemptsPerMonth { get; set; } = 10_000;
    [Range(1, long.MaxValue)] public long MaxStorageBytes { get; set; } = 5L * 1024 * 1024 * 1024;
    [Range(1, 10_000_000)] public int MaxCertificatesPerMonth { get; set; } = 10_000;
}

public class CreatePlanRequest
{
    [Required, StringLength(40, MinimumLength = 2)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    public string Code { get; set; } = string.Empty;
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    [Required] public PlanLimitsDto Limits { get; set; } = new();
}

public sealed class UpdatePlanRequest : CreatePlanRequest
{
    [Required] public uint BaseVersion { get; set; }
}

public sealed class PlanResponse
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public PlanLimitsDto Limits { get; set; } = new();
    public uint Version { get; set; }
}

public sealed class ActivateSubscriptionRequest
{
    [Required] public Guid PlanId { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

public sealed class SubscriptionResponse
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

public sealed class PlatformTenantResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public SubscriptionResponse? Subscription { get; set; }
}

public sealed class PlatformUserResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool EmailConfirmed { get; set; }
    public DateTimeOffset? LockoutEnd { get; set; }
    public int TenantCount { get; set; }
    public IReadOnlyList<string> PlatformRoles { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public sealed class UpdatePlatformUserStatusRequest
{
    public bool Suspended { get; set; }
}

public sealed class UsageMetricResponse
{
    public string Metric { get; set; } = string.Empty;
    public long Value { get; set; }
    public long? Limit { get; set; }
}

public sealed class TenantUsageResponse
{
    public Guid TenantId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public IReadOnlyList<UsageMetricResponse> Metrics { get; set; } = [];
}

public sealed class AuditLogResponse
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

public sealed class ReferralCodeResponse
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
