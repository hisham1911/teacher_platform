using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Domain.Saas;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record ResolvedCommercialContract(
    CommercialPlanContractDto Contract,
    string CommercialStatus,
    bool IsGrandfathered,
    Subscription? Subscription,
    Plan? Plan);

/// <summary>
/// Server-authoritative resolver for the commercial contract stored in Plans.LimitsJson.
/// V2 uses an envelope (contractVersion/package/limits/entitlements). Legacy flat JSON remains readable.
/// Existing workspaces with no subscription are grandfathered so new capacities never lock them out.
/// </summary>
public sealed class PlanLimitResolver
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly QuizLimitOptions _fallback;
    private readonly TeacherPlatform.Application.Abstractions.IClock _clock;

    public PlanLimitResolver(
        AppDbContext db,
        IOptions<QuizLimitOptions> fallback,
        TeacherPlatform.Application.Abstractions.IClock clock)
    {
        _db = db;
        _fallback = fallback.Value;
        _clock = clock;
    }

    public async Task<PlanLimitsDto> GetAsync(Guid tenantId, CancellationToken cancellationToken) =>
        (await ResolveAsync(tenantId, cancellationToken)).Contract.Limits;

    public async Task<CommercialPlanContractDto> GetContractAsync(Guid tenantId, CancellationToken cancellationToken) =>
        (await ResolveAsync(tenantId, cancellationToken)).Contract;

    public async Task<ResolvedCommercialContract> ResolveAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var subscriptions = await _db.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(subscription => subscription.Plan)
            .Where(subscription => subscription.TenantId == tenantId)
            .OrderByDescending(subscription => subscription.StartsAt)
            .ThenByDescending(subscription => subscription.CreatedAt)
            .ToListAsync(cancellationToken);

        var effective = subscriptions.FirstOrDefault(subscription =>
            subscription.Status == SubscriptionStatus.Active &&
            subscription.StartsAt <= now &&
            (subscription.EndsAt == null || subscription.EndsAt > now) &&
            subscription.Plan is { IsActive: true });

        if (effective?.Plan is not null)
        {
            return new ResolvedCommercialContract(
                DeserializeContract(effective.Plan.LimitsJson),
                "Active",
                false,
                effective,
                effective.Plan);
        }

        var latest = subscriptions.FirstOrDefault();
        if (latest is not null)
        {
            var status = latest.Status switch
            {
                SubscriptionStatus.Active when latest.StartsAt > now => "Inactive",
                SubscriptionStatus.Active when latest.EndsAt is DateTime endsAt && endsAt <= now => "Expired",
                _ => latest.Status.ToString()
            };
            var contract = latest.Plan is null
                ? BuildLegacyCompatibilityContract()
                : DeserializeContract(latest.Plan.LimitsJson);
            return new ResolvedCommercialContract(contract, status, false, latest, latest.Plan);
        }

        return new ResolvedCommercialContract(
            BuildLegacyCompatibilityContract(),
            "Grandfathered",
            true,
            null,
            null);
    }

    public CommercialPlanContractDto BuildLegacyCompatibilityContract() => new()
    {
        ContractVersion = CommercialContract.CurrentVersion,
        Package = CommercialContract.GrandfatheredPackage,
        Limits = new PlanLimitsDto
        {
            MaxQuizzesPerTenant = _fallback.MaxQuizzesPerTenant,
            MaxQuestionsPerQuiz = _fallback.MaxQuestionsPerQuiz,
            MaxPublishedQuizzesPerTenant = _fallback.MaxPublishedQuizzesPerTenant,
            // All newly introduced capacities intentionally use the DTO's high compatibility defaults.
            MaxAttemptsPerMonth = 10_000,
            MaxStorageBytes = 5L * 1024 * 1024 * 1024,
            MaxCertificatesPerMonth = 10_000,
            MaxStudents = 100_000,
            MaxMembers = 10_000,
            MaxClasses = 100_000,
            MaxActiveAssignments = 100_000,
            MaxLiveParticipants = 10_000
        },
        Entitlements = PlanEntitlementsDto.LegacyCompatibility()
    };

    public static string Serialize(CommercialPlanContractDto contract)
    {
        contract.ContractVersion = CommercialContract.CurrentVersion;
        return JsonSerializer.Serialize(contract, JsonOptions);
    }

    /// <summary>Legacy overload retained for old tests/callers. New code should serialize the full contract.</summary>
    public static string Serialize(PlanLimitsDto limits) => JsonSerializer.Serialize(limits, JsonOptions);

    public static PlanLimitsDto Deserialize(string json) => DeserializeContract(json).Limits;

    public static CommercialPlanContractDto DeserializeContract(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new InvalidOperationException("Plan limits are invalid.");
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("limits", out _))
            {
                var contract = JsonSerializer.Deserialize<CommercialPlanContractDto>(json, JsonOptions)
                    ?? throw new InvalidOperationException("Plan contract is invalid.");
                if (contract.ContractVersion is < 1 or > CommercialContract.CurrentVersion)
                {
                    throw new InvalidOperationException($"Unsupported plan contract version {contract.ContractVersion}.");
                }
                return contract;
            }

            // V1 / historical shape: the root object itself is PlanLimitsDto.
            var legacyLimits = JsonSerializer.Deserialize<PlanLimitsDto>(json, JsonOptions)
                ?? throw new InvalidOperationException("Plan limits are invalid.");
            return new CommercialPlanContractDto
            {
                ContractVersion = 1,
                Package = CommercialContract.GrandfatheredPackage,
                Limits = legacyLimits,
                // These capabilities existed before commercial entitlements, so removing them would be a breaking change.
                Entitlements = PlanEntitlementsDto.LegacyCompatibility()
            };
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Plan limits are invalid.", exception);
        }
    }

    public static PlanResponse ToPlanResponse(Plan plan)
    {
        var contract = DeserializeContract(plan.LimitsJson);
        return new PlanResponse
        {
            Id = plan.Id,
            Code = plan.Code,
            Name = plan.Name,
            IsActive = plan.IsActive,
            ContractVersion = contract.ContractVersion,
            Package = contract.Package,
            Limits = contract.Limits,
            Entitlements = contract.Entitlements,
            Version = plan.Version
        };
    }
}
