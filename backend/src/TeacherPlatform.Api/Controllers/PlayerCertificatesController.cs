using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;
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

    public PlayerCertificatesController(
        CertificateService certificateService,
        ParentShareService parentShareService,
        IOptions<AuthOptions> authOptions)
    {
        _certificateService = certificateService;
        _parentShareService = parentShareService;
        _authOptions = authOptions;
    }

    [HttpPost("sessions/{joinCode}/attempts/{attemptId:guid}/certificate")]
    [ProducesResponseType(typeof(PlayerCertificateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PlayerCertificateResponse), StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Issue(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var (error, certificate) = await _certificateService.GetOrCreateForPlayerAsync(
            joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return certificate!.Status == "Ready" ? Ok(certificate) : Accepted(certificate);
    }

    [HttpGet("sessions/{joinCode}/attempts/{attemptId:guid}/certificate/file")]
    [Produces("application/pdf")]
    public async Task<IActionResult> DownloadForPlayer(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var (error, file) = await _certificateService.OpenForPlayerAsync(
            joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return File(file!.Value.Content, "application/pdf", file.Value.FileName, enableRangeProcessing: true);
    }

    [HttpPost("sessions/{joinCode}/attempts/{attemptId:guid}/parent-share")]
    [ProducesResponseType(typeof(ParentShareResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateParentShare(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var (error, share) = await _parentShareService.CreateAsync(
            joinCode, attemptId, RequireGuestToken(), cancellationToken);
        if (error is not null) throw error;
        return StatusCode(StatusCodes.Status201Created, share);
    }

    [HttpGet("certificates/{publicToken}")]
    [Produces("application/pdf")]
    public async Task<IActionResult> OpenPublic(
        [FromRoute] string publicToken,
        CancellationToken cancellationToken)
    {
        var (error, file) = await _certificateService.OpenPublicAsync(publicToken, cancellationToken);
        if (error is not null) throw error;
        return File(file!.Value.Content, "application/pdf", enableRangeProcessing: true);
    }

    private string RequireGuestToken()
    {
        var cookieName = GuestTokenService.ResolveCookieName(_authOptions.Value.UseSecureCookie);
        if (Request.Cookies.TryGetValue(cookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken))
        {
            return rawToken;
        }

        throw new TeacherPlatform.Application.Abstractions.ServiceResultException(
            "Unauthorized", "Guest token cookie is missing.");
    }
}
