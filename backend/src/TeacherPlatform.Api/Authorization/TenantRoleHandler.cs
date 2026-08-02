using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TeacherPlatform.Api.Middleware;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Authorization;

/// <summary>
/// Requirement لسياسات المستأجر. دور المستأجر يُقرأ من عضوية قاعدة البيانات فقط —
/// أبدًا من الطلب أو من JWT.
/// </summary>
public sealed class TenantRoleRequirement : IAuthorizationRequirement
{
    /// <summary>أي دور نشط داخل المستأجر.</summary>
    public const string AnyTenantRole = "AnyTenantRole";

    /// <summary>Owner فقط.</summary>
    public const string OwnerOnly = "OwnerOnly";

    public TenantRoleRequirement(string mode)
    {
        Mode = mode;
    }

    public string Mode { get; }
}

public sealed class TenantRoleHandler : AuthorizationHandler<TenantRoleRequirement>
{
    private readonly TenantBypassService _bypass;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantRoleHandler(TenantBypassService bypass, IHttpContextAccessor httpContextAccessor)
    {
        _bypass = bypass;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        TenantRoleRequirement requirement)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return;
        }

        var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            return;
        }

        // Tenant المرغوب يأتي من Route {tenantId} — الـMiddleware حلّله وحقق العضوية مسبقًا
        if (!httpContext.Items.TryGetValue(TenantResolutionMiddleware.TenantIdItemKey, out var tenantIdObj)
            || tenantIdObj is not Guid tenantId)
        {
            return;
        }

        // المصدر الوحيد للدور هو قاعدة البيانات
        var membership = await _bypass.FindMembershipIgnoreFiltersAsync(tenantId, userId, httpContext.RequestAborted);
        if (membership is null || membership.Status != TenantMembershipStatus.Active)
        {
            return;
        }

        if (requirement.Mode == TenantRoleRequirement.AnyTenantRole)
        {
            context.Succeed(requirement);
            return;
        }

        if (requirement.Mode == TenantRoleRequirement.OwnerOnly && membership.Role == TenantMemberRole.Owner)
        {
            context.Succeed(requirement);
        }
    }
}
