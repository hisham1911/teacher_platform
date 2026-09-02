using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Reports;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class ReportsController : ControllerBase
{
    private readonly ReportService _reportService;
    private readonly CommercialPolicyService _commercial;

    public ReportsController(ReportService reportService, CommercialPolicyService commercial)
    {
        _reportService = reportService;
        _commercial = commercial;
    }

    [HttpGet("sessions/{sessionId:guid}/report")]
    public async Task<IActionResult> GetSessionReport(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        var report = await _reportService.GetSessionReportAsync(sessionId, cancellationToken);
        if (report is null) throw new ServiceResultException("NotFound", "Session not found.");

        // Basic results remain available. Question-level analytics are a commercial entitlement.
        if (!await _commercial.HasEntitlementAsync(tenantId, CommercialEntitlements.AdvancedReports, cancellationToken))
            report.Questions = [];
        return Ok(report);
    }

    [HttpGet("sessions/{sessionId:guid}/attempts")]
    public async Task<IActionResult> ListAttempts(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken) =>
        Ok(await _reportService.ListAttemptsAsync(sessionId, page, pageSize, cancellationToken));

    [HttpGet("attempts/{attemptId:guid}")]
    public async Task<IActionResult> GetAttempt(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var attempt = await _reportService.GetAttemptAsync(attemptId, cancellationToken);
        if (attempt is null) throw new ServiceResultException("NotFound", "Attempt not found.");
        return Ok(attempt);
    }

    [HttpGet("sessions/{sessionId:guid}/report/export.csv")]
    [EnableRateLimiting(RateLimitPolicies.ReportExports)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportSessionCsv(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        await _commercial.RequireEntitlementAsync(tenantId, CommercialEntitlements.DataExport, cancellationToken);
        var exportFile = await _reportService.ExportSessionCsvAsync(sessionId, cancellationToken);
        if (exportFile is null) throw new ServiceResultException("NotFound", "Session not found.");
        return File(exportFile.Value.Content, "text/csv; charset=utf-8", exportFile.Value.FileName);
    }
}
