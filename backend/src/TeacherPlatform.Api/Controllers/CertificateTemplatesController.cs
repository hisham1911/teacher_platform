using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/certificate-templates")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class CertificateTemplatesController : ControllerBase
{
    private readonly CertificateTemplateService _templateService;

    public CertificateTemplatesController(CertificateTemplateService templateService)
    {
        _templateService = templateService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CertificateTemplateResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        CancellationToken cancellationToken) =>
        Ok(await _templateService.ListAsync(cancellationToken));

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(CertificateTemplateResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] SaveCertificateTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var (error, template) = await _templateService.CreateAsync(request, cancellationToken);
        if (error is not null) throw error;
        return StatusCode(StatusCodes.Status201Created, template);
    }

    [HttpPut("{templateId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(CertificateTemplateResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid templateId,
        [FromBody] SaveCertificateTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var (error, template) = await _templateService.UpdateAsync(templateId, request, cancellationToken);
        if (error is not null) throw error;
        return Ok(template);
    }
}
