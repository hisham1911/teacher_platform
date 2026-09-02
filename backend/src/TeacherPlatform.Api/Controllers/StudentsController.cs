using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/students")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class StudentsController : ControllerBase
{
    private readonly StudentService _studentService;
    private readonly StudentPortalService _portalService;

    public StudentsController(StudentService studentService, StudentPortalService portalService)
    {
        _studentService = studentService;
        _portalService = portalService;
    }

    // StudentCode and portal access are credentials, not ordinary workspace metadata.
    // Keep the entire roster behind Owner/Teacher rather than AnyTenantRole.
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(IReadOnlyList<StudentResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        [FromQuery] string? search,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var students = await _studentService.ListAsync(search, includeInactive, cancellationToken);
        return Ok(students);
    }

    [HttpGet("{studentId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        CancellationToken cancellationToken)
    {
        var student = await _studentService.GetAsync(studentId, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateStudentRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var student = await _studentService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { tenantId, studentId = student.Id }, student);
    }

    [HttpPut("{studentId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        [FromBody] UpdateStudentRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var student = await _studentService.UpdateAsync(studentId, request, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPost("{studentId:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetStatus(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        [FromBody] UpdateStudentStatusRequest request,
        CancellationToken cancellationToken)
    {
        var student = await _studentService.SetActiveAsync(studentId, request, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPost("{studentId:guid}/regenerate-code")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RegenerateCode(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        [FromBody] RegenerateStudentCodeRequest request,
        CancellationToken cancellationToken)
    {
        var student = await _studentService.RegenerateCodeAsync(studentId, request, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpGet("{studentId:guid}/results")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(IReadOnlyList<StudentResultResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Results(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        [FromQuery] int take = 20,
        CancellationToken cancellationToken = default)
    {
        var results = await _studentService.ListResultsAsync(studentId, take, cancellationToken);
        return Ok(results);
    }

    [HttpGet("{studentId:guid}/portal-access")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentPortalAccessStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PortalAccess(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        CancellationToken cancellationToken) =>
        Ok(await _portalService.GetAccessStatusAsync(studentId, cancellationToken));

    [HttpPost("{studentId:guid}/portal-access")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(StudentPortalAccessCodeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RotatePortalAccess(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        CancellationToken cancellationToken) =>
        Ok(await _portalService.RotateAccessCodeAsync(studentId, cancellationToken));

    [HttpDelete("{studentId:guid}/portal-access")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokePortalAccess(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid studentId,
        CancellationToken cancellationToken)
    {
        await _portalService.RevokeAccessAsync(studentId, cancellationToken);
        return NoContent();
    }
}
