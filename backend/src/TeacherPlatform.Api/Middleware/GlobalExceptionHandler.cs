using Microsoft.AspNetCore.Diagnostics;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Api.Middleware;

/// <summary>
/// معالج الأخطاء العام:
/// - ServiceResultException => 4xx مع ErrorCode تقني (بلا تفاصيل أمنية زائدة).
/// - CrossTenantWriteRejectedException => 403.
/// - الباقي => 500 عام بدون تفاصيل داخلية.
/// لا يسرّب Tokens أو Passwords أو Stack traces للعميل.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

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
                    "QuotaExceeded" => StatusCodes.Status403Forbidden,
                    "FileTooLarge" => StatusCodes.Status413PayloadTooLarge,
                    _ => StatusCodes.Status400BadRequest
                };
                title = serviceError.ErrorCode;
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
