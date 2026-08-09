using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/referrals")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.TenantOwner)]
public sealed class ReferralsController : ControllerBase
{
    private readonly ReferralService _service;

    public ReferralsController(ReferralService service) => _service = service;

    [HttpPost("code")]
    public async Task<IActionResult> GetOrCreateCode(Guid tenantId, CancellationToken cancellationToken)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(value, out var userId))
        {
            throw new ServiceResultException("Unauthorized", "User identity is invalid.");
        }
        return Ok(await _service.GetOrCreateAsync(userId, cancellationToken));
    }
}
