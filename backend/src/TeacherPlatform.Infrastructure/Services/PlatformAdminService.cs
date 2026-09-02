using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Saas;
using TeacherPlatform.Domain.Students;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class PlatformAdminService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly PlanLimitResolver _limits;
    private readonly CommercialPolicyService _commercial;

    public PlatformAdminService(
        AppDbContext db,
        TeacherPlatform.Application.Tenancy.ITenantContext tenantContext,
        IClock clock,
        PlanLimitResolver limits,
        CommercialPolicyService commercial)
    {
        _db = db;
        _tenantContext = (TenantContext)tenantContext;
        _clock = clock;
        _limits = limits;
        _commercial = commercial;
    }

    public Task<IReadOnlyList<CommercialPackageCatalogItemResponse>> ListPackagesAsync(CancellationToken cancellationToken) =>
        Task.FromResult(CommercialPackageCatalog.All);

    public async Task<IReadOnlyList<PlanResponse>> ListPlansAsync(CancellationToken cancellationToken) =>
        (await _db.Plans.AsNoTracking().OrderBy(plan => plan.Name).ToListAsync(cancellationToken))
            .Select(PlanLimitResolver.ToPlanResponse)
            .ToList();

    public async Task<(ServiceResultException? Error, PlanResponse? Result)> CreatePlanAsync(
        CreatePlanRequest request,
        Guid actorUserId,
        string? requestId,
        CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToLowerInvariant();
        if (await _db.Plans.AnyAsync(plan => plan.Code == code, cancellationToken))
        {
            return (new ServiceResultException("Conflict", "Plan code already exists."), null);
        }
        if (!ValidateContract(request.Contract, out var contractError))
        {
            return (contractError, null);
        }

        var now = _clock.UtcNow;
        var plan = new Plan
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            IsActive = request.IsActive,
            LimitsJson = PlanLimitResolver.Serialize(request.Contract),
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Plans.Add(plan);
        AddAudit(actorUserId, null, "PlanCreated", "Plan", plan.Id.ToString(), new
        {
            plan.Code,
            request.Contract.Package,
            request.Contract.ContractVersion,
            request.Contract.Entitlements
        }, requestId);
        await _db.SaveChangesAsync(cancellationToken);
        return (null, PlanLimitResolver.ToPlanResponse(plan));
    }

    public async Task<(ServiceResultException? Error, PlanResponse? Result)> UpdatePlanAsync(
        Guid planId,
        UpdatePlanRequest request,
        Guid actorUserId,
        string? requestId,
        CancellationToken cancellationToken)
    {
        var plan = await _db.Plans.SingleOrDefaultAsync(current => current.Id == planId, cancellationToken);
        if (plan is null) return (new ServiceResultException("NotFound", "Plan not found."), null);
        if (plan.Version != request.BaseVersion)
        {
            return (new ServiceResultException("Conflict", "Plan changed. Reload and try again."), null);
        }
        if (!ValidateContract(request.Contract, out var contractError))
        {
            return (contractError, null);
        }

        var code = request.Code.Trim().ToLowerInvariant();
        if (await _db.Plans.AnyAsync(current => current.Id != planId && current.Code == code, cancellationToken))
        {
            return (new ServiceResultException("Conflict", "Plan code already exists."), null);
        }

        var previous = PlanLimitResolver.DeserializeContract(plan.LimitsJson);
        plan.Code = code;
        plan.Name = request.Name.Trim();
        plan.IsActive = request.IsActive;
        plan.LimitsJson = PlanLimitResolver.Serialize(request.Contract);
        plan.UpdatedAt = _clock.UtcNow;
        AddAudit(actorUserId, null, "PlanUpdated", "Plan", plan.Id.ToString(), new
        {
            plan.Code,
            PreviousPackage = previous.Package,
            Package = request.Contract.Package,
            PreviousEntitlements = previous.Entitlements,
            Entitlements = request.Contract.Entitlements
        }, requestId);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "Plan changed. Reload and try again."), null);
        }
        return (null, PlanLimitResolver.ToPlanResponse(plan));
    }

    public async Task<IReadOnlyList<PlatformTenantResponse>> ListTenantsAsync(CancellationToken cancellationToken)
    {
        var tenants = await _db.Tenants.AsNoTracking().OrderByDescending(tenant => tenant.CreatedAt).ToListAsync(cancellationToken);
        var result = new List<PlatformTenantResponse>(tenants.Count);
        foreach (var tenant in tenants)
        {
            var commercial = await _commercial.GetWorkspaceStateAsync(tenant.Id, cancellationToken);
            result.Add(new PlatformTenantResponse
            {
                Id = tenant.Id,
                Name = tenant.Name,
                Slug = tenant.Slug,
                Status = tenant.Status.ToString(),
                CreatedAt = tenant.CreatedAt,
                Subscription = commercial.Subscription,
                CommercialStatus = commercial.CommercialStatus,
                IsGrandfathered = commercial.IsGrandfathered,
                Plan = commercial.Plan,
                Usage = commercial.Usage
            });
        }
        return result;
    }

    public async Task<IReadOnlyList<PlatformUserResponse>> ListUsersAsync(CancellationToken cancellationToken)
    {
        var users = await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking() on user.Id equals profile.UserId
            orderby profile.CreatedAt descending
            select new PlatformUserResponse
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                FullName = profile.FullName,
                Status = profile.Status.ToString(),
                EmailConfirmed = user.EmailConfirmed,
                LockoutEnd = user.LockoutEnd,
                CreatedAt = profile.CreatedAt
            }).ToListAsync(cancellationToken);
        var userIds = users.Select(user => user.Id).ToList();
        var tenantCounts = await _db.TenantMemberships.IgnoreQueryFilters().AsNoTracking()
            .Where(membership => userIds.Contains(membership.UserId) && membership.Status == TenantMembershipStatus.Active)
            .GroupBy(membership => membership.UserId)
            .Select(group => new { UserId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.UserId, item => item.Count, cancellationToken);
        var roles = await (
            from userRole in _db.UserRoles.AsNoTracking()
            join role in _db.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where userIds.Contains(userRole.UserId)
            select new { userRole.UserId, Role = role.Name! })
            .ToListAsync(cancellationToken);
        var rolesByUser = roles.GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(item => item.Role).Order().ToList());

        foreach (var user in users)
        {
            user.TenantCount = tenantCounts.GetValueOrDefault(user.Id);
            user.PlatformRoles = rolesByUser.GetValueOrDefault(user.Id) ?? [];
        }
        return users;
    }

    public async Task<ServiceResultException?> UpdateUserStatusAsync(
        Guid userId,
        UpdatePlatformUserStatusRequest request,
        Guid actorUserId,
        string? requestId,
        CancellationToken cancellationToken)
    {
        if (request.Suspended && userId == actorUserId)
        {
            return new ServiceResultException("ValidationError", "You cannot suspend your own account.");
        }

        var user = await _db.Users.SingleOrDefaultAsync(current => current.Id == userId, cancellationToken);
        var profile = await _db.UserProfiles.SingleOrDefaultAsync(current => current.UserId == userId, cancellationToken);
        if (user is null || profile is null)
        {
            return new ServiceResultException("NotFound", "User not found.");
        }

        var targetStatus = request.Suspended ? UserProfileStatus.Suspended : UserProfileStatus.Active;
        if (profile.Status == targetStatus) return null;

        profile.Status = targetStatus;
        profile.UpdatedAt = _clock.UtcNow;
        user.LockoutEnabled = true;
        user.LockoutEnd = request.Suspended ? DateTimeOffset.MaxValue : null;
        user.AccessFailedCount = 0;

        if (request.Suspended)
        {
            var now = _clock.UtcNow;
            var activeTokens = await _db.RefreshTokens
                .Where(token => token.UserId == userId && token.RevokedAt == null && token.ExpiresAt > now)
                .ToListAsync(cancellationToken);
            foreach (var token in activeTokens)
            {
                token.RevokedAt = now;
                token.RevokedReason = "PlatformAdminSuspended";
            }
        }

        AddAudit(actorUserId, null, request.Suspended ? "UserSuspended" : "UserRestored", "User", userId.ToString(),
            new { Status = targetStatus.ToString() }, requestId);
        await _db.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<ServiceResultException?> UpdateTenantStatusAsync(
        Guid tenantId,
        UpdatePlatformTenantStatusRequest request,
        Guid actorUserId,
        string? requestId,
        CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.SingleOrDefaultAsync(item => item.Id == tenantId, cancellationToken);
        if (tenant is null) return new ServiceResultException("NotFound", "Workspace not found.");

        var target = request.Suspended ? TenantStatus.Suspended : TenantStatus.Active;
        if (tenant.Status == target) return null;

        tenant.Status = target;
        tenant.UpdatedAt = _clock.UtcNow;
        if (request.Suspended)
        {
            var sessions = await _db.StudentPortalSessions.IgnoreQueryFilters()
                .Where(item => item.TenantId == tenantId && item.RevokedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var session in sessions) session.RevokedAt = _clock.UtcNow;
        }

        AddAudit(actorUserId, tenantId, request.Suspended ? "TenantSuspended" : "TenantReactivated", "Tenant", tenantId.ToString(),
            new { Status = target.ToString(), request.Reason }, requestId);
        await _db.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<(ServiceResultException? Error, SubscriptionResponse? Result)> ActivateSubscriptionAsync(
        Guid tenantId,
        ActivateSubscriptionRequest request,
        Guid actorUserId,
        string? requestId,
        CancellationToken cancellationToken)
    {
        if (!await _db.Tenants.AnyAsync(tenant => tenant.Id == tenantId, cancellationToken))
        {
            return (new ServiceResultException("NotFound", "Tenant not found."), null);
        }
        var plan = await _db.Plans.SingleOrDefaultAsync(current => current.Id == request.PlanId, cancellationToken);
        if (plan is null || !plan.IsActive)
        {
            return (new ServiceResultException("NotFound", "Active plan not found."), null);
        }

        var startsAt = request.StartsAt ?? _clock.UtcNow;
        if (request.EndsAt is DateTime endsAt && endsAt <= startsAt)
        {
            return (new ServiceResultException("ValidationError", "EndsAt must be after StartsAt."), null);
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        using var bootstrap = _tenantContext.BeginBootstrap(tenantId);
        var active = await _db.Subscriptions.IgnoreQueryFilters()
            .Include(item => item.Plan)
            .Where(subscription => subscription.TenantId == tenantId && subscription.Status == SubscriptionStatus.Active)
            .ToListAsync(cancellationToken);
        var previousPlan = active.OrderByDescending(item => item.StartsAt).FirstOrDefault()?.Plan?.Code;
        foreach (var current in active)
        {
            current.Status = SubscriptionStatus.Cancelled;
            current.EndsAt ??= startsAt;
            current.UpdatedAt = _clock.UtcNow;
        }

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = plan.Id,
            Status = SubscriptionStatus.Active,
            StartsAt = startsAt,
            EndsAt = request.EndsAt,
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow,
            Plan = plan
        };
        _db.Subscriptions.Add(subscription);
        AddAudit(actorUserId, tenantId, "SubscriptionActivated", "Subscription", subscription.Id.ToString(), new
        {
            PreviousPlan = previousPlan,
            NewPlan = plan.Code,
            request.ChangeReason,
            StartsAt = startsAt,
            request.EndsAt
        }, requestId);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return (new ServiceResultException("Conflict", "The tenant subscription changed. Reload and try again."), null);
        }
        await transaction.CommitAsync(cancellationToken);
        return (null, ToSubscriptionResponse(subscription, "Active"));
    }

    public async Task<TenantUsageResponse?> RefreshUsageAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!await _db.Tenants.AsNoTracking().AnyAsync(tenant => tenant.Id == tenantId, cancellationToken)) return null;

        var now = _clock.UtcNow;
        var periodStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var periodEnd = periodStart.AddMonths(1);
        var values = new Dictionary<string, long>
        {
            [UsageMetrics.PublishedQuizzes] = await _db.Quizzes.IgnoreQueryFilters().LongCountAsync(
                quiz => quiz.TenantId == tenantId && quiz.Status == QuizStatus.Published, cancellationToken),
            [UsageMetrics.Attempts] = await _db.Attempts.IgnoreQueryFilters().LongCountAsync(
                attempt => attempt.TenantId == tenantId && attempt.StartedAt >= periodStart && attempt.StartedAt < periodEnd,
                cancellationToken),
            [UsageMetrics.StorageBytes] = await _db.MediaAssets.IgnoreQueryFilters()
                .Where(asset => asset.TenantId == tenantId)
                .SumAsync(asset => (long?)asset.SizeBytes, cancellationToken) ?? 0,
            [UsageMetrics.CertificatesIssued] = await _db.Certificates.IgnoreQueryFilters().LongCountAsync(
                certificate => certificate.TenantId == tenantId && certificate.Status == CertificateStatus.Ready
                    && certificate.IssuedAt >= periodStart && certificate.IssuedAt < periodEnd,
                cancellationToken),
            [UsageMetrics.Students] = await _db.Students.IgnoreQueryFilters().LongCountAsync(
                student => student.TenantId == tenantId && student.IsActive, cancellationToken),
            [UsageMetrics.Members] = await _db.TenantMemberships.IgnoreQueryFilters().LongCountAsync(
                member => member.TenantId == tenantId && member.Status == TenantMembershipStatus.Active, cancellationToken)
        };

        using var bootstrap = _tenantContext.BeginBootstrap(tenantId);
        var counters = await _db.UsageCounters.IgnoreQueryFilters()
            .Where(counter => counter.TenantId == tenantId && counter.PeriodStart == periodStart)
            .ToListAsync(cancellationToken);
        foreach (var (metric, value) in values)
        {
            var counter = counters.SingleOrDefault(item => item.Metric == metric);
            if (counter is null)
            {
                counter = new UsageCounter
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PeriodStart = periodStart,
                    PeriodEnd = periodEnd,
                    Metric = metric
                };
                _db.UsageCounters.Add(counter);
            }
            counter.Value = value;
            counter.UpdatedAt = now;
        }
        await _db.SaveChangesAsync(cancellationToken);

        var limits = await _limits.GetAsync(tenantId, cancellationToken);
        var limitByMetric = new Dictionary<string, long>
        {
            [UsageMetrics.PublishedQuizzes] = limits.MaxPublishedQuizzesPerTenant,
            [UsageMetrics.Attempts] = limits.MaxAttemptsPerMonth,
            [UsageMetrics.StorageBytes] = limits.MaxStorageBytes,
            [UsageMetrics.CertificatesIssued] = limits.MaxCertificatesPerMonth,
            [UsageMetrics.Students] = limits.MaxStudents,
            [UsageMetrics.Members] = limits.MaxMembers
        };
        return new TenantUsageResponse
        {
            TenantId = tenantId,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Metrics = values.Select(pair => new UsageMetricResponse
            {
                Metric = pair.Key,
                Value = pair.Value,
                Limit = limitByMetric[pair.Key],
                NearLimit = limitByMetric[pair.Key] > 0 && pair.Value * 100 >= limitByMetric[pair.Key] * 80
            }).ToList()
        };
    }

    public async Task<IReadOnlyList<AuditLogResponse>> ListAuditAsync(Guid? tenantId, int take, CancellationToken cancellationToken) =>
        await _db.AuditLogs.AsNoTracking()
            .Where(log => tenantId == null || log.TenantId == tenantId)
            .OrderByDescending(log => log.CreatedAt)
            .Take(Math.Clamp(take, 1, 200))
            .Select(log => new AuditLogResponse
            {
                Id = log.Id,
                TenantId = log.TenantId,
                ActorUserId = log.ActorUserId,
                Action = log.Action,
                EntityType = log.EntityType,
                EntityId = log.EntityId,
                MetadataJson = log.MetadataJson,
                RequestId = log.RequestId,
                CreatedAt = log.CreatedAt
            })
            .ToListAsync(cancellationToken);

    private static bool ValidateContract(CommercialPlanContractDto contract, out ServiceResultException? error)
    {
        error = null;
        contract.ContractVersion = CommercialContract.CurrentVersion;
        var package = CommercialPackageCatalog.All.SingleOrDefault(item =>
            string.Equals(item.Package, contract.Package, StringComparison.OrdinalIgnoreCase));
        if (package is { IsAvailable: false })
        {
            error = new ServiceResultException("ValidationError", "The School package is reserved for a later commercial phase.");
            return false;
        }
        if (contract.Entitlements.CustomDomain)
        {
            error = new ServiceResultException("ValidationError", "Custom domain provisioning is not available in this phase.");
            return false;
        }
        return true;
    }

    private void AddAudit(Guid actorUserId, Guid? tenantId, string action, string entityType, string? entityId, object metadata, string? requestId) =>
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), TenantId = tenantId, ActorUserId = actorUserId, Action = action,
            EntityType = entityType, EntityId = entityId, MetadataJson = JsonSerializer.Serialize(metadata),
            RequestId = requestId, CreatedAt = _clock.UtcNow
        });

    private static SubscriptionResponse ToSubscriptionResponse(Subscription subscription, string? effectiveStatus = null) => new()
    {
        Id = subscription.Id,
        TenantId = subscription.TenantId,
        PlanId = subscription.PlanId,
        PlanCode = subscription.Plan?.Code ?? string.Empty,
        PlanName = subscription.Plan?.Name ?? string.Empty,
        Status = effectiveStatus ?? subscription.Status.ToString(),
        StartsAt = subscription.StartsAt,
        EndsAt = subscription.EndsAt
    };
}
