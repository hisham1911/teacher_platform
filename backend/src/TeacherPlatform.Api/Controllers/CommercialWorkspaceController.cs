using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/commercial")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class CommercialWorkspaceController : ControllerBase
{
    private readonly CommercialPolicyService _commercial;

    public CommercialWorkspaceController(CommercialPolicyService commercial) => _commercial = commercial;

    [HttpGet]
    [ProducesResponseType(typeof(CommercialWorkspaceStateResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromRoute] Guid tenantId, CancellationToken cancellationToken) =>
        Ok(await _commercial.GetWorkspaceStateAsync(tenantId, cancellationToken));
}
