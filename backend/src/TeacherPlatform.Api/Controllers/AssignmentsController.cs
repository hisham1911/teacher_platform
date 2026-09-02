using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Assignments;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/assignments")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
public sealed class AssignmentsController : ControllerBase
{
    private readonly AssignmentService _service;
    public AssignmentsController(AssignmentService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List([FromRoute] Guid tenantId, CancellationToken cancellationToken) => Ok(await _service.ListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid tenantId, [FromBody] CreateAssignmentRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { tenantId, assignmentId = result.Id }, result);
    }

    [HttpGet("{assignmentId:guid}")]
    public async Task<IActionResult> Get([FromRoute] Guid tenantId, [FromRoute] Guid assignmentId, CancellationToken cancellationToken)
    {
        var result = await _service.GetAsync(assignmentId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{assignmentId:guid}/recipients")]
    public async Task<IActionResult> Recipients([FromRoute] Guid tenantId, [FromRoute] Guid assignmentId, CancellationToken cancellationToken) =>
        Ok(await _service.ListRecipientsAsync(assignmentId, cancellationToken));

    [HttpGet("{assignmentId:guid}/results")]
    public async Task<IActionResult> Results([FromRoute] Guid tenantId, [FromRoute] Guid assignmentId, CancellationToken cancellationToken) =>
        Ok(await _service.ListResultsAsync(assignmentId, cancellationToken));
}
