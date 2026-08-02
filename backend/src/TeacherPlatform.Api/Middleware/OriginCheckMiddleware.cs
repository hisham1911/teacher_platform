using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Api.Middleware;

/// <summary>
/// Origin Check للعمليات الحساسة المعتمدة على الكوكي (Refresh/Logout).
/// CORS وحدها لا تكفي كحماية CSRF — نتحقق صراحة أن Origin ضمن القائمة الموثوقة عند وجوده.
/// طلبات بدون Origin (CLI/اختبارات مباشرة) تمر؛ المتصفحات ترفع Origin دائمًا في POST عبر المواقع.
/// </summary>
public sealed class OriginCheckMiddleware
{
    private readonly RequestDelegate _next;

    public OriginCheckMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IOptions<AuthOptions> authOptions)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        var isSensitive = path.Equals("/api/v1/auth/refresh", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/auth/logout", StringComparison.OrdinalIgnoreCase);

        if (isSensitive
            && context.Request.Headers.TryGetValue("Origin", out var originHeader)
            && !string.IsNullOrWhiteSpace(originHeader))
        {
            var origin = originHeader.ToString().TrimEnd('/');
            var trusted = authOptions.Value.TrustedOrigins.Select(o => o.TrimEnd('/'));
            if (!trusted.Contains(origin, StringComparer.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(new
                {
                    type = "https://httpstatuses.com/403",
                    title = "Untrusted origin.",
                    status = StatusCodes.Status403Forbidden,
                    traceId = context.TraceIdentifier
                });
                return;
            }
        }

        await _next(context);
    }
}
