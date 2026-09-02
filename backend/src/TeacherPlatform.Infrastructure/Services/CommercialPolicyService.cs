using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public enum CommercialCapacity
{
    Students,
    Members,
    Classes,
    ActiveAssignments,
    LiveParticipants
}

public sealed class CommercialPolicyService
{
    private readonly AppDbContext _db;
    private readonly PlanLimitResolver _resolver;
    private readonly IClock _clock;

    public CommercialPolicyService(AppDbContext db, PlanLimitResolver resolver, IClock clock)
    {
        _db = db;
        _resolver = resolver;
        _clock = clock;
    }

    public async Task<CommercialWorkspaceStateResponse> GetWorkspaceStateAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == tenantId, cancellationToken)
            ?? throw new ServiceResultException("NotFound", "Workspace not found.");
        var resolved = await _resolver.ResolveAsync(tenantId, cancellationToken);
        var memberCount = await _db.TenantMemberships
            .IgnoreQueryFilters()
            .AsNoTracking()
            .LongCountAsync(
                item => item.TenantId == tenantId && item.Status == TenantMembershipStatus.Active,
                cancellationToken);
        var studentCount = await _db.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .LongCountAsync(
                item => item.TenantId == tenantId && item.IsActive,
                cancellationToken);
        var classCount = await _db.Classrooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .LongCountAsync(
                item => item.TenantId == tenantId && item.IsActive,
                cancellationToken);
        var activeAssignmentCount = await _db.Assignments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .LongCountAsync(
                item => item.TenantId == tenantId && item.Session!.Status == SessionStatus.Active,
                cancellationToken);

        return new CommercialWorkspaceStateResponse
        {
            TenantId = tenantId,
            CommercialStatus = tenant.Status == TenantStatus.Active ? resolved.CommercialStatus : "Suspended",
            IsGrandfathered = resolved.IsGrandfathered,
            Subscription = resolved.Subscription is null
                ? null
                : ToSubscriptionResponse(resolved.Subscription, resolved.CommercialStatus),
            Plan = resolved.Plan is null ? null : PlanLimitResolver.ToPlanResponse(resolved.Plan),
            Limits = resolved.Contract.Limits,
            Entitlements = resolved.Contract.Entitlements,
            Usage = new PlatformTenantUsageSummaryResponse
            {
                Members = memberCount,
                Students = studentCount,
                Classes = classCount,
                ActiveAssignments = activeAssignmentCount
            }
        };
    }

    public async Task<CommercialPlanContractDto> RequireWorkspaceMutationAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var tenantStatus = await _db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.Id == tenantId)
            .Select(item => (TenantStatus?)item.Status)
            .SingleOrDefaultAsync(cancellationToken);
        if (tenantStatus is null)
        {
            throw new ServiceResultException("NotFound", "Workspace not found.");
        }

        if (tenantStatus != TenantStatus.Active)
        {
            throw new ServiceResultException("WorkspaceSuspended", "This workspace is suspended.");
        }

        var resolved = await _resolver.ResolveAsync(tenantId, cancellationToken);
        if (!resolved.IsGrandfathered && resolved.CommercialStatus != "Active")
        {
            throw new ServiceResultException(
                "SubscriptionInactive",
                "This workspace does not have an active commercial subscription.");
        }

        return resolved.Contract;
    }

    public async Task<bool> HasEntitlementAsync(
        Guid tenantId,
        string entitlement,
        CancellationToken cancellationToken)
    {
        var tenantActive = await _db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(
                item => item.Id == tenantId && item.Status == TenantStatus.Active,
                cancellationToken);
        if (!tenantActive)
        {
            return false;
        }

        var resolved = await _resolver.ResolveAsync(tenantId, cancellationToken);
        if (!resolved.IsGrandfathered && resolved.CommercialStatus != "Active")
        {
            return false;
        }

        return resolved.Contract.Entitlements.Has(entitlement);
    }

    public async Task RequireEntitlementAsync(
        Guid tenantId,
        string entitlement,
        CancellationToken cancellationToken)
    {
        var contract = await RequireWorkspaceMutationAsync(tenantId, cancellationToken);
        if (!contract.Entitlements.Has(entitlement))
        {
            throw new ServiceResultException(
                "EntitlementRequired",
                $"The '{entitlement}' feature is not included in the current plan.");
        }
    }

    public async Task<int> GetCapacityLimitAsync(
        Guid tenantId,
        CommercialCapacity capacity,
        CancellationToken cancellationToken)
    {
        var limits = (await RequireWorkspaceMutationAsync(tenantId, cancellationToken)).Limits;
        return capacity switch
        {
            CommercialCapacity.Students => limits.MaxStudents,
            CommercialCapacity.Members => limits.MaxMembers,
            CommercialCapacity.Classes => limits.MaxClasses,
            CommercialCapacity.ActiveAssignments => limits.MaxActiveAssignments,
            CommercialCapacity.LiveParticipants => limits.MaxLiveParticipants,
            _ => throw new ArgumentOutOfRangeException(nameof(capacity), capacity, null)
        };
    }

    public async Task EnsureCapacityAsync(
        Guid tenantId,
        CommercialCapacity capacity,
        long currentValue,
        CancellationToken cancellationToken)
    {
        var limit = await GetCapacityLimitAsync(tenantId, capacity, cancellationToken);
        if (currentValue >= limit)
        {
            throw new ServiceResultException(
                "QuotaExceeded",
                $"This workspace reached its {CapacityKey(capacity)} limit ({limit}). Upgrade the plan or free capacity and try again.");
        }
    }

    public async Task AcquireCapacityLockAsync(
        Guid tenantId,
        CommercialCapacity capacity,
        CancellationToken cancellationToken,
        Guid? scopeId = null)
    {
        if (_db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException(
                "A database transaction is required before acquiring a commercial capacity lock.");
        }

        var key = scopeId is Guid scoped
            ? $"commercial:{tenantId:N}:{CapacityKey(capacity)}:{scoped:N}"
            : $"commercial:{tenantId:N}:{CapacityKey(capacity)}";
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0));",
            cancellationToken);
    }

    public DateTime UtcNow => _clock.UtcNow;

    private static string CapacityKey(CommercialCapacity capacity) => capacity switch
    {
        CommercialCapacity.Students => "students",
        CommercialCapacity.Members => "members",
        CommercialCapacity.Classes => "classes",
        CommercialCapacity.ActiveAssignments => "active-assignments",
        CommercialCapacity.LiveParticipants => "live-participants",
        _ => capacity.ToString().ToLowerInvariant()
    };

    private static SubscriptionResponse ToSubscriptionResponse(
        Domain.Saas.Subscription subscription,
        string effectiveStatus) => new()
    {
        Id = subscription.Id,
        TenantId = subscription.TenantId,
        PlanId = subscription.PlanId,
        PlanCode = subscription.Plan?.Code ?? string.Empty,
        PlanName = subscription.Plan?.Name ?? string.Empty,
        Status = effectiveStatus,
        StartsAt = subscription.StartsAt,
        EndsAt = subscription.EndsAt
    };
}
