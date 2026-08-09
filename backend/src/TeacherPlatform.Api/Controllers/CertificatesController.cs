using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/certificates")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class CertificatesController : ControllerBase
{
    private readonly CertificateService _certificateService;

    public CertificatesController(CertificateService certificateService)
    {
        _certificateService = certificateService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CertificateListItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        CancellationToken cancellationToken) =>
        Ok(await _certificateService.ListAsync(cancellationToken));

    [HttpGet("{certificateId:guid}/file")]
    [Produces("application/pdf")]
    public async Task<IActionResult> Download(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid certificateId,
        CancellationToken cancellationToken)
    {
        var (error, file) = await _certificateService.OpenForTeacherAsync(certificateId, cancellationToken);
        if (error is not null) throw error;
        return File(file!.Value.Content, "application/pdf", file.Value.FileName, enableRangeProcessing: true);
    }

    [HttpPost("{certificateId:guid}/retry")]
    [ProducesResponseType(typeof(CertificateListItemResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Retry(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid certificateId,
        CancellationToken cancellationToken)
    {
        var (error, certificate) = await _certificateService.RetryAsync(certificateId, cancellationToken);
        if (error is not null) throw error;
        return Ok(certificate);
    }
}
