using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/transfer")]
[Authorize(Policy = AuthorizationPolicies.TenantOwner)]
public sealed class TenantTransfersController : ControllerBase
{
    private readonly TenantTransferService _service;

    public TenantTransfersController(TenantTransferService service) => _service = service;

    [HttpGet("export")]
    [Produces("application/zip")]
    [EnableRateLimiting(RateLimitPolicies.ReportExports)]
    public async Task<IActionResult> Export(Guid tenantId, CancellationToken cancellationToken)
    {
        var export = await _service.ExportAsync(tenantId, RequireActorId(), cancellationToken);
        return File(export.Content, "application/zip", export.FileName, enableRangeProcessing: false);
    }

    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(TenantTransferService.MaxArchiveBytes + 1_048_576)]
    public async Task<IActionResult> Import(
        Guid tenantId,
        [FromForm] IFormFile archive,
        [FromQuery] bool dryRun = true,
        CancellationToken cancellationToken = default)
    {
        if (archive.Length <= 0 || archive.Length > TenantTransferService.MaxArchiveBytes)
        {
            throw new ServiceResultException("FileTooLarge", "Import archive is empty or exceeds 250 MB.");
        }
        await using var content = archive.OpenReadStream();
        var result = await _service.ImportAsync(new TenantImportRequest(
            tenantId,
            RequireActorId(),
            content,
            archive.Length,
            dryRun,
            HttpContext.TraceIdentifier), cancellationToken);
        return Ok(result);
    }

    private Guid RequireActorId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(value, out var actorId)
            ? actorId
            : throw new ServiceResultException("Unauthorized", "User identity is invalid.");
    }
}
