using System.Security.Claims;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Api.Middleware;

/// <summary>
/// Tenant Resolution لنقاط /api/v1/tenants/{tenantId}/...:
/// 1. يستخرج معرف المستخدم من Access Token ومعرّف المستأجر من Route.
/// 2. يقرأ X-Tenant-Id إن وُجد ويرفض الطلب إن خالف الـRoute.
/// 3. يتحقق من عضوية نشطة من قاعدة البيانات — الـHeader اختيار Workspace فقط وليس دليل صلاحية.
/// 4. بعد النجاح يضبط TenantContext. عدم الوجود يعني أن Global Filters لن تعرض بيانات مستأجر.
/// </summary>
public sealed class TenantResolutionMiddleware
{
    public const string TenantIdItemKey = "TenantId";

    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(
        HttpContext context,
        TenantContext tenantContext,
        TenantBypassService bypass)
    {
        if (TryGetRouteTenantId(context, out var routeTenantId))
        {
            if (!(context.User.Identity?.IsAuthenticated ?? false))
            {
                // غير مصادق — اترك Authorization يعيد 401/403 لاحقًا دون كشف شيء
                await _next(context);
                return;
            }

            if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue)
                && !string.IsNullOrWhiteSpace(headerValue))
            {
                if (!Guid.TryParse(headerValue.ToString(), out var headerTenantId)
                    || headerTenantId != routeTenantId)
                {
                    await WriteProblemAsync(context, StatusCodes.Status400BadRequest, "Tenant route/header mismatch.");
                    return;
                }
            }

            var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirstValue("sub");
            if (!Guid.TryParse(userIdValue, out var userId))
            {
                await WriteProblemAsync(context, StatusCodes.Status401Unauthorized, "Unauthorized.");
                return;
            }

            var membership = await bypass.FindMembershipIgnoreFiltersAsync(routeTenantId, userId, context.RequestAborted);
            if (membership is null)
            {
                await WriteProblemAsync(context, StatusCodes.Status404NotFound, "Workspace not found or you are not a member.");
                return;
            }

            if (membership.Status != TenantMembershipStatus.Active)
            {
                await WriteProblemAsync(context, StatusCodes.Status403Forbidden, "Your membership is suspended.");
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
            // سيناريو /auth/me مع اختيار Workspace من الواجهة: الـHeader اختيار فقط.
            // إن كانت العضوية نشطة، حدّد السياق ليعيد /me معلومات السياق المختار.
            var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirstValue("sub");
            if (Guid.TryParse(userIdValue, out var userId))
            {
                var membership = await bypass.FindMembershipIgnoreFiltersAsync(headerTenantGuid, userId, context.RequestAborted);
                if (membership is not null && membership.Status == TenantMembershipStatus.Active)
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
        // مسارات بشكل /api/v1/tenants/{tenantId}/...
        if (context.Request.RouteValues.TryGetValue("tenantId", out var routeValue)
            && routeValue is not null
            && Guid.TryParse(routeValue.ToString(), out var parsed))
        {
            tenantId = parsed;
            return true;
        }
        return false;
    }

    private static async Task WriteProblemAsync(HttpContext context, int statusCode, string title)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new
        {
            type = $"https://httpstatuses.com/{statusCode}",
            title,
            status = statusCode,
            traceId = context.TraceIdentifier
        });
    }
}
