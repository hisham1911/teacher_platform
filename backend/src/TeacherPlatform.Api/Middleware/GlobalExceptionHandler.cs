using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Middleware;

/// <summary>
/// معالج الأخطاء العام:
/// - ServiceResultException => 4xx مع ErrorCode تقني (بلا تفاصيل أمنية زائدة).
/// - CrossTenantWriteRejectedException => 403.
/// - الباقي => 500 عام بدون تفاصيل داخلية.
/// لا يسرّب Tokens أو Passwords أو Stack traces للعميل.
/// عند 401 على مسارات اللاعب (player) مع رمز ضيف منتهي/بُطّل، يُحذف كوكي الضيف العالق
/// حتى لا يتكرر 401 بلا نهاية — حذف الكوكي هنا بعد Response.Clear() الذي يُنفَّذ قبل انع��ال
/// هذا المعالج (Set-Cookie من الكنترولر كان سيُمْسَح).
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IOptions<AuthOptions> _authOptions;

    public GlobalExceptionHandler(
        ILogger<GlobalExceptionHandler> logger,
        IOptions<AuthOptions> authOptions)
    {
        _logger = logger;
        _authOptions = authOptions;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        int statusCode;
        string title;

        switch (exception)
        {
            case ServiceResultException serviceError:
                statusCode = serviceError.ErrorCode switch
                {
                    "Unauthorized" => StatusCodes.Status401Unauthorized,
                    "EmailNotConfirmed" => StatusCodes.Status403Forbidden,
                    "LockedOut" => StatusCodes.Status423Locked,
                    "NotFound" => StatusCodes.Status404NotFound,
                    "SlugConflict" => StatusCodes.Status409Conflict,
                    "DuplicateMember" => StatusCodes.Status409Conflict,
                    "Conflict" => StatusCodes.Status409Conflict,
                    "AnswerConflict" => StatusCodes.Status409Conflict,
                    "SessionNotActive" => StatusCodes.Status409Conflict,
                    "AttemptFinished" => StatusCodes.Status409Conflict,
                    "LiveModeNotAvailable" => StatusCodes.Status400BadRequest,
                    "InvalidAnswerPayload" => StatusCodes.Status400BadRequest,
                    "QuotaExceeded" => StatusCodes.Status403Forbidden,
                    "FileTooLarge" => StatusCodes.Status413PayloadTooLarge,
                    _ => StatusCodes.Status400BadRequest
                };
                title = serviceError.ErrorCode;

                if (statusCode == StatusCodes.Status401Unauthorized &&
                    httpContext.Request.Path.StartsWithSegments("/api/v1/player/sessions"))
                {
                    DeleteStaleGuestCookie(httpContext.Response);
                }

                _logger.LogWarning(
                    "Request failed. Code={ErrorCode} TraceId={TraceId}",
                    serviceError.ErrorCode, httpContext.TraceIdentifier);
                break;

            case CrossTenantWriteRejectedException crossTenant:
                statusCode = StatusCodes.Status403Forbidden;
                title = "CrossTenantOperationRejected";
                _logger.LogWarning(
                    crossTenant,
                    "Cross-tenant mutation blocked. TraceId={TraceId}",
                    httpContext.TraceIdentifier);
                break;

            case TenantWriteWithoutContextException noContext:
                statusCode = StatusCodes.Status500InternalServerError;
                title = "InternalError";
                _logger.LogError(
                    noContext,
                    "Tenant-owned write without resolved tenant context. TraceId={TraceId}",
                    httpContext.TraceIdentifier);
                break;

            default:
                statusCode = StatusCodes.Status500InternalServerError;
                title = "InternalError";
                _logger.LogError(exception, "Unhandled exception. TraceId={TraceId}", httpContext.TraceIdentifier);
                break;
        }

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(new
        {
            type = $"https://httpstatuses.com/{statusCode}",
            title,
            status = statusCode,
            detail = statusCode >= 500 ? "An unexpected error occurred." : exception.Message,
            traceId = httpContext.TraceIdentifier
        }, cancellationToken);

        return true;
    }

    /// <summary>
    /// يحذف كوكي ضيف اللاعب العالق (رمز منتهي/بُطّل) بنفس الاسم والسمات الأصلية —
    /// Path=/, HttpOnly، Secure حسب الإعدادات وSameSite من الإعدادات. أي كوكي فاسد
    /// عند أي 401 على مسارات اللاعب (ولا يوجد كوكي صالح) ⇒ المتصفح يتخلّص منه.
    /// </summary>
    private void DeleteStaleGuestCookie(HttpResponse response)
    {
        var options = _authOptions.Value;
        response.Cookies.Delete(GuestTokenService.ResolveCookieName(options.UseSecureCookie), new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = options.CookieSameSite switch
            {
                "Lax" => SameSiteMode.Lax,
                "None" => SameSiteMode.None,
                _ => SameSiteMode.Strict
            },
            Path = "/",
            IsEssential = true
        });
    }
}

/// <summary>يضيف X-Request-Id لكل استجابة لربط السجلات.</summary>
public sealed class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = context.TraceIdentifier;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers.Append("X-Request-Id", requestId);
            return Task.CompletedTask;
        });

        await _next(context);
    }
}
