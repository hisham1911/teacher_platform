using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Reports;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class ReportsController : ControllerBase
{
    private readonly ReportService _reportService;

    public ReportsController(ReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("sessions/{sessionId:guid}/report")]
    [ProducesResponseType(typeof(SessionReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionReport(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        var report = await _reportService.GetSessionReportAsync(sessionId, cancellationToken);
        if (report is null)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return Ok(report);
    }

    [HttpGet("sessions/{sessionId:guid}/attempts")]
    [ProducesResponseType(typeof(PagedResponse<AttemptListItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListAttempts(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var attempts = await _reportService.ListAttemptsAsync(sessionId, page, pageSize, cancellationToken);
        return Ok(attempts);
    }

    [HttpGet("attempts/{attemptId:guid}")]
    [ProducesResponseType(typeof(AttemptDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAttempt(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var attempt = await _reportService.GetAttemptAsync(attemptId, cancellationToken);
        if (attempt is null)
        {
            throw new ServiceResultException("NotFound", "Attempt not found.");
        }

        return Ok(attempt);
    }

    [HttpGet("sessions/{sessionId:guid}/report/export.csv")]
    [EnableRateLimiting(RateLimitPolicies.ReportExports)]
    [Produces("text/csv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ExportSessionCsv(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        var exportFile = await _reportService.ExportSessionCsvAsync(sessionId, cancellationToken);
        if (exportFile is null)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return File(exportFile.Value.Content, "text/csv; charset=utf-8", exportFile.Value.FileName);
    }
}
