using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Saas;

public static class CommercialContract
{
    public const int CurrentVersion = 2;
    public const string GrandfatheredPackage = "Legacy";
}

public static class CommercialEntitlements
{
    public const string BulkImport = "bulkImport";
    public const string AdvancedReports = "advancedReports";
    public const string Certificates = "certificates";
    public const string CustomBranding = "customBranding";
    public const string DataExport = "dataExport";
    public const string CustomDomain = "customDomain";
}

public sealed class PlanLimitsDto
{
    [Range(1, 100_000)] public int MaxQuizzesPerTenant { get; set; } = 100;
    [Range(1, 10_000)] public int MaxQuestionsPerQuiz { get; set; } = 200;
    [Range(1, 100_000)] public int MaxPublishedQuizzesPerTenant { get; set; } = 50;
    [Range(1, 10_000_000)] public int MaxAttemptsPerMonth { get; set; } = 10_000;
    [Range(1, long.MaxValue)] public long MaxStorageBytes { get; set; } = 5L * 1024 * 1024 * 1024;
    [Range(1, 10_000_000)] public int MaxCertificatesPerMonth { get; set; } = 10_000;

    // Commercial SaaS v2 capacities. Legacy contracts deserialize to compatibility-safe defaults.
    [Range(1, 1_000_000)] public int MaxStudents { get; set; } = 100_000;
    [Range(1, 100_000)] public int MaxMembers { get; set; } = 10_000;
    [Range(1, 1_000_000)] public int MaxClasses { get; set; } = 100_000;
    [Range(1, 1_000_000)] public int MaxActiveAssignments { get; set; } = 100_000;
    [Range(1, 100_000)] public int MaxLiveParticipants { get; set; } = 10_000;
}

public sealed class PlanEntitlementsDto
{
    public bool BulkImport { get; set; }
    public bool AdvancedReports { get; set; }
    public bool Certificates { get; set; }
    public bool CustomBranding { get; set; }
    public bool DataExport { get; set; }
    public bool CustomDomain { get; set; }

    public bool Has(string entitlement) => entitlement switch
    {
        CommercialEntitlements.BulkImport => BulkImport,
        CommercialEntitlements.AdvancedReports => AdvancedReports,
        CommercialEntitlements.Certificates => Certificates,
        CommercialEntitlements.CustomBranding => CustomBranding,
        CommercialEntitlements.DataExport => DataExport,
        CommercialEntitlements.CustomDomain => CustomDomain,
        _ => false
    };

    public static PlanEntitlementsDto LegacyCompatibility() => new()
    {
        BulkImport = true,
        AdvancedReports = true,
        Certificates = true,
        CustomBranding = true,
        DataExport = true,
        CustomDomain = false
    };
}

public sealed class CommercialPlanContractDto
{
    [Range(1, CommercialContract.CurrentVersion)]
    public int ContractVersion { get; set; } = CommercialContract.CurrentVersion;

    [Required, StringLength(40)]
    public string Package { get; set; } = "Teacher";

    [Required]
    public PlanLimitsDto Limits { get; set; } = new();

    [Required]
    public PlanEntitlementsDto Entitlements { get; set; } = new();
}

public sealed class CommercialPackageCatalogItemResponse
{
    public string Package { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
    public PlanLimitsDto Limits { get; set; } = new();
    public PlanEntitlementsDto Entitlements { get; set; } = new();
}

public static class CommercialPackageCatalog
{
    public static IReadOnlyList<CommercialPackageCatalogItemResponse> All { get; } =
    [
        new()
        {
            Package = "Teacher",
            DisplayName = "Teacher",
            IsAvailable = true,
            Limits = new PlanLimitsDto
            {
                MaxQuizzesPerTenant = 50,
                MaxQuestionsPerQuiz = 100,
                MaxPublishedQuizzesPerTenant = 20,
                MaxAttemptsPerMonth = 5_000,
                MaxStorageBytes = 1024L * 1024 * 1024,
                MaxCertificatesPerMonth = 200,
                MaxStudents = 150,
                MaxMembers = 1,
                MaxClasses = 10,
                MaxActiveAssignments = 20,
                MaxLiveParticipants = 50
            },
            Entitlements = new PlanEntitlementsDto()
        },
        new()
        {
            Package = "TeacherPro",
            DisplayName = "Teacher Pro",
            IsAvailable = true,
            Limits = new PlanLimitsDto
            {
                MaxQuizzesPerTenant = 250,
                MaxQuestionsPerQuiz = 200,
                MaxPublishedQuizzesPerTenant = 100,
                MaxAttemptsPerMonth = 50_000,
                MaxStorageBytes = 10L * 1024 * 1024 * 1024,
                MaxCertificatesPerMonth = 5_000,
                MaxStudents = 1_000,
                MaxMembers = 5,
                MaxClasses = 75,
                MaxActiveAssignments = 250,
                MaxLiveParticipants = 250
            },
            Entitlements = new PlanEntitlementsDto
            {
                BulkImport = true,
                AdvancedReports = true,
                Certificates = true,
                CustomBranding = true,
                DataExport = true
            }
        },
        new()
        {
            Package = "Academy",
            DisplayName = "Academy",
            IsAvailable = true,
            Limits = new PlanLimitsDto
            {
                MaxQuizzesPerTenant = 1_000,
                MaxQuestionsPerQuiz = 300,
                MaxPublishedQuizzesPerTenant = 500,
                MaxAttemptsPerMonth = 500_000,
                MaxStorageBytes = 100L * 1024 * 1024 * 1024,
                MaxCertificatesPerMonth = 50_000,
                MaxStudents = 10_000,
                MaxMembers = 50,
                MaxClasses = 500,
                MaxActiveAssignments = 2_500,
                MaxLiveParticipants = 1_000
            },
            Entitlements = new PlanEntitlementsDto
            {
                BulkImport = true,
                AdvancedReports = true,
                Certificates = true,
                CustomBranding = true,
                DataExport = true
            }
        },
        new()
        {
            Package = "School",
            DisplayName = "School (Later)",
            IsAvailable = false,
            Limits = new PlanLimitsDto
            {
                MaxQuizzesPerTenant = 10_000,
                MaxQuestionsPerQuiz = 500,
                MaxPublishedQuizzesPerTenant = 5_000,
                MaxAttemptsPerMonth = 5_000_000,
                MaxStorageBytes = 1024L * 1024 * 1024 * 1024,
                MaxCertificatesPerMonth = 500_000,
                MaxStudents = 100_000,
                MaxMembers = 500,
                MaxClasses = 5_000,
                MaxActiveAssignments = 20_000,
                MaxLiveParticipants = 5_000
            },
            Entitlements = new PlanEntitlementsDto
            {
                BulkImport = true,
                AdvancedReports = true,
                Certificates = true,
                CustomBranding = true,
                DataExport = true,
                CustomDomain = true
            }
        }
    ];
}

public class CreatePlanRequest
{
    private CommercialPlanContractDto _contract = new();
    private bool _explicitContractAssigned;

    [Required, StringLength(40, MinimumLength = 2)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    public string Code { get; set; } = string.Empty;

    [Required, StringLength(120, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [Required]
    public CommercialPlanContractDto Contract
    {
        get => _contract;
        set
        {
            _contract = value ?? new CommercialPlanContractDto();
            _explicitContractAssigned = true;
        }
    }

    /// <summary>
    /// Backward-compatible write alias for pre-v2 callers that submitted a flat `limits` object.
    /// It becomes a Legacy package with compatibility entitlements and never overrides an explicit v2 contract.
    /// </summary>
    public PlanLimitsDto? Limits
    {
        get => null;
        set
        {
            if (value is null || _explicitContractAssigned)
            {
                return;
            }

            _contract = new CommercialPlanContractDto
            {
                ContractVersion = CommercialContract.CurrentVersion,
                Package = CommercialContract.GrandfatheredPackage,
                Limits = value,
                Entitlements = PlanEntitlementsDto.LegacyCompatibility()
            };
        }
    }
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
    public int ContractVersion { get; set; }
    public string Package { get; set; } = string.Empty;
    public PlanLimitsDto Limits { get; set; } = new();
    public PlanEntitlementsDto Entitlements { get; set; } = new();
    public uint Version { get; set; }
}

public sealed class ActivateSubscriptionRequest
{
    [Required] public Guid PlanId { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    [StringLength(300)] public string? ChangeReason { get; set; }
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

public sealed class PlatformTenantUsageSummaryResponse
{
    public long Members { get; set; }
    public long Students { get; set; }
    public long? Classes { get; set; }
    public long? ActiveAssignments { get; set; }
}

public sealed class PlatformTenantResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public SubscriptionResponse? Subscription { get; set; }
    public string CommercialStatus { get; set; } = string.Empty;
    public bool IsGrandfathered { get; set; }
    public PlanResponse? Plan { get; set; }
    public PlatformTenantUsageSummaryResponse Usage { get; set; } = new();
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

public sealed class UpdatePlatformTenantStatusRequest
{
    public bool Suspended { get; set; }
    [StringLength(300)] public string? Reason { get; set; }
}

public sealed class UsageMetricResponse
{
    public string Metric { get; set; } = string.Empty;
    public long Value { get; set; }
    public long? Limit { get; set; }
    public bool NearLimit { get; set; }
}

public sealed class TenantUsageResponse
{
    public Guid TenantId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public IReadOnlyList<UsageMetricResponse> Metrics { get; set; } = [];
}

public sealed class CommercialWorkspaceStateResponse
{
    public Guid TenantId { get; set; }
    public string CommercialStatus { get; set; } = string.Empty;
    public bool IsGrandfathered { get; set; }
    public SubscriptionResponse? Subscription { get; set; }
    public PlanResponse? Plan { get; set; }
    public PlanLimitsDto Limits { get; set; } = new();
    public PlanEntitlementsDto Entitlements { get; set; } = new();
    public PlatformTenantUsageSummaryResponse Usage { get; set; } = new();
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
