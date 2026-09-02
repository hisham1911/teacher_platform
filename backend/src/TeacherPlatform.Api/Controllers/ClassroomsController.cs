using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Classrooms;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/classrooms")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
public sealed class ClassroomsController : ControllerBase
{
    private readonly ClassroomService _service;
    public ClassroomsController(ClassroomService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List([FromRoute] Guid tenantId, [FromQuery] bool includeInactive = false, CancellationToken cancellationToken = default) =>
        Ok(await _service.ListAsync(includeInactive, cancellationToken));

    [HttpGet("{classroomId:guid}")]
    public async Task<IActionResult> Get([FromRoute] Guid tenantId, [FromRoute] Guid classroomId, CancellationToken cancellationToken)
    {
        var result = await _service.GetAsync(classroomId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] Guid tenantId, [FromBody] CreateClassroomRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { tenantId, classroomId = result.Id }, result);
    }

    [HttpPut("{classroomId:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid tenantId, [FromRoute] Guid classroomId, [FromBody] UpdateClassroomRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _service.UpdateAsync(classroomId, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{classroomId:guid}/status")]
    public async Task<IActionResult> SetStatus([FromRoute] Guid tenantId, [FromRoute] Guid classroomId, [FromBody] UpdateClassroomStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _service.SetActiveAsync(classroomId, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{classroomId:guid}/students")]
    public async Task<IActionResult> AddStudent([FromRoute] Guid tenantId, [FromRoute] Guid classroomId, [FromBody] ClassroomStudentRequest request, CancellationToken cancellationToken)
    {
        if (request.StudentId == Guid.Empty) return BadRequest();
        var result = await _service.AddStudentAsync(classroomId, request.StudentId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{classroomId:guid}/students/{studentId:guid}")]
    public async Task<IActionResult> RemoveStudent([FromRoute] Guid tenantId, [FromRoute] Guid classroomId, [FromRoute] Guid studentId, CancellationToken cancellationToken) =>
        await _service.RemoveStudentAsync(classroomId, studentId, cancellationToken) ? NoContent() : NotFound();
}
