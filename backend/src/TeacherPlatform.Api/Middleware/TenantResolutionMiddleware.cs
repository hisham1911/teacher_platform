using System.Security.Claims;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Middleware;

/// <summary>
/// Resolves tenant context from the route/header and rejects suspended memberships/workspaces before tenant services run.
/// Tenant identity and status are always loaded from the server; X-Tenant-Id is only a workspace selector.
/// PlatformAdmin API routes are deliberately excluded: they are protected by the PlatformAdmin policy and must be able
/// to inspect/reactivate a suspended workspace without the tenant-level suspension guard blocking the administrative action.
/// </summary>
public sealed class TenantResolutionMiddleware
{
    public const string TenantIdItemKey = "TenantId";
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(
        HttpContext context,
        TenantContext tenantContext,
        TenantBypassService bypass)
    {
        if (context.Request.Path.StartsWithSegments("/api/v1/platform"))
        {
            await _next(context);
            return;
        }

        if (TryGetRouteTenantId(context, out var routeTenantId))
        {
            if (!(context.User.Identity?.IsAuthenticated ?? false))
            {
                await _next(context);
                return;
            }

            if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue)
                && !string.IsNullOrWhiteSpace(headerValue)
                && (!Guid.TryParse(headerValue.ToString(), out var headerTenantId)
                    || headerTenantId != routeTenantId))
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status400BadRequest,
                    "Tenant route/header mismatch.",
                    "TenantMismatch");
                return;
            }

            var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirstValue("sub");
            if (!Guid.TryParse(userIdValue, out var userId))
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status401Unauthorized,
                    "Unauthorized.",
                    "Unauthorized");
                return;
            }

            var membership = await bypass.FindMembershipIncludeTenantIgnoreFiltersAsync(
                routeTenantId,
                userId,
                context.RequestAborted);
            if (membership is null)
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status404NotFound,
                    "Workspace not found or you are not a member.",
                    "NotFound");
                return;
            }

            if (membership.Status != TenantMembershipStatus.Active)
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status403Forbidden,
                    "Your membership is suspended.",
                    "MembershipSuspended");
                return;
            }

            if (membership.Tenant?.Status != TenantStatus.Active)
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status423Locked,
                    "This workspace is suspended.",
                    "WorkspaceSuspended");
                return;
            }

            tenantContext.SetResolved(routeTenantId);
            context.Items[TenantIdItemKey] = routeTenantId;
        }
        else if (!tenantContext.IsResolved
            && context.User.Identity?.IsAuthenticated == true
            && context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerOnly)
            && Guid.TryParse(headerOnly.ToString(), out var headerTenantGuid))
        {
            var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirstValue("sub");
            if (Guid.TryParse(userIdValue, out var userId))
            {
                var membership = await bypass.FindMembershipIncludeTenantIgnoreFiltersAsync(
                    headerTenantGuid,
                    userId,
                    context.RequestAborted);
                if (membership is not null
                    && membership.Status == TenantMembershipStatus.Active
                    && membership.Tenant?.Status == TenantStatus.Active)
                {
                    tenantContext.SetResolved(headerTenantGuid);
                    context.Items[TenantIdItemKey] = headerTenantGuid;
                }
            }
        }

        await _next(context);
    }

    private static bool TryGetRouteTenantId(HttpContext context, out Guid tenantId)
    {
        tenantId = default;
        return context.Request.RouteValues.TryGetValue("tenantId", out var routeValue)
            && routeValue is not null
            && Guid.TryParse(routeValue.ToString(), out tenantId);
    }

    private static async Task WriteProblemAsync(
        HttpContext context,
        int statusCode,
        string detail,
        string code)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new
        {
            type = $"https://httpstatuses.com/{statusCode}",
            title = code,
            errorCode = code,
            status = statusCode,
            detail,
            userMessageAr = code switch
            {
                "WorkspaceSuspended" => "مساحة العمل موقوفة حاليًا.",
                "MembershipSuspended" => "عضويتك في مساحة العمل موقوفة حاليًا.",
                _ => null
            },
            traceId = context.TraceIdentifier
        });
    }
}
