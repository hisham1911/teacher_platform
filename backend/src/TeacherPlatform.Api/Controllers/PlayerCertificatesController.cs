using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/player")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class PlayerCertificatesController : ControllerBase
{
    private readonly CertificateService _certificateService;
    private readonly ParentShareService _parentShareService;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly AppDbContext _db;
    private readonly CommercialPolicyService _commercial;

    public PlayerCertificatesController(
        CertificateService certificateService,
        ParentShareService parentShareService,
        IOptions<AuthOptions> authOptions,
        AppDbContext db,
        CommercialPolicyService commercial)
    {
        _certificateService = certificateService;
        _parentShareService = parentShareService;
        _authOptions = authOptions;
        _db = db;
        _commercial = commercial;
    }

    [HttpPost("sessions/{joinCode}/attempts/{attemptId:guid}/certificate")]
    public async Task<IActionResult> Issue([FromRoute] string joinCode, [FromRoute] Guid attemptId, CancellationToken cancellationToken)
    {
        var normalized = joinCode.Trim().ToUpperInvariant();
        var tenantId = await _db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(item => item.JoinCode == normalized)
            .Select(item => (Guid?)item.TenantId)
            .SingleOrDefaultAsync(cancellationToken);
        if (tenantId is null) throw new ServiceResultException("NotFound", "Activity not found.");
        await _commercial.RequireEntitlementAsync(tenantId.Value, CommercialEntitlements.Certificates, cancellationToken);

        var (error, certificate) = await _certificateService.GetOrCreateForPlayerAsync(
            joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return certificate!.Status == "Ready" ? Ok(certificate) : Accepted(certificate);
    }

    [HttpGet("sessions/{joinCode}/attempts/{attemptId:guid}/certificate/file")]
    [Produces("application/pdf")]
    public async Task<IActionResult> DownloadForPlayer([FromRoute] string joinCode, [FromRoute] Guid attemptId, CancellationToken cancellationToken)
    {
        var (error, file) = await _certificateService.OpenForPlayerAsync(joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return File(file!.Value.Content, "application/pdf", file.Value.FileName, enableRangeProcessing: true);
    }

    [HttpPost("sessions/{joinCode}/attempts/{attemptId:guid}/parent-share")]
    public async Task<IActionResult> CreateParentShare([FromRoute] string joinCode, [FromRoute] Guid attemptId, CancellationToken cancellationToken)
    {
        var (error, share) = await _parentShareService.CreateAsync(joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return StatusCode(StatusCodes.Status201Created, share);
    }

    [HttpGet("certificates/{publicToken}")]
    [Produces("application/pdf")]
    public async Task<IActionResult> OpenPublic([FromRoute] string publicToken, CancellationToken cancellationToken)
    {
        var (error, file) = await _certificateService.OpenPublicAsync(publicToken, cancellationToken);
        if (error is not null) throw error;
        return File(file!.Value.Content, "application/pdf", enableRangeProcessing: true);
    }

    private string RequireGuestToken()
    {
        var cookieName = GuestTokenService.ResolveCookieName(_authOptions.Value.UseSecureCookie);
        if (Request.Cookies.TryGetValue(cookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken)) return rawToken;
        throw new ServiceResultException("Unauthorized", "Guest token cookie is missing.");
    }
}
