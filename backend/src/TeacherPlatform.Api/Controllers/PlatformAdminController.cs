using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/platform")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
public sealed class PlatformAdminController : ControllerBase
{
    private readonly PlatformAdminService _service;
    private readonly IClock _clock;

    public PlatformAdminController(PlatformAdminService service, IClock clock)
    {
        _service = service;
        _clock = clock;
    }

    [HttpGet("packages")]
    public async Task<IActionResult> ListPackages(CancellationToken cancellationToken) =>
        Ok(await _service.ListPackagesAsync(cancellationToken));

    [HttpGet("plans")]
    public async Task<IActionResult> ListPlans(CancellationToken cancellationToken) =>
        Ok(await _service.ListPlansAsync(cancellationToken));

    [HttpPost("plans")]
    public async Task<IActionResult> CreatePlan([FromBody] CreatePlanRequest request, CancellationToken cancellationToken)
    {
        EnsureSupportedPackage(request.Contract.Package);
        var (error, result) = await _service.CreatePlanAsync(request, RequireActorId(), HttpContext.TraceIdentifier, cancellationToken);
        if (error is not null) throw error;
        return Created($"/api/v1/platform/plans/{result!.Id}", result);
    }

    [HttpPut("plans/{planId:guid}")]
    public async Task<IActionResult> UpdatePlan(Guid planId, [FromBody] UpdatePlanRequest request, CancellationToken cancellationToken)
    {
        EnsureSupportedPackage(request.Contract.Package);
        var (error, result) = await _service.UpdatePlanAsync(planId, request, RequireActorId(), HttpContext.TraceIdentifier, cancellationToken);
        if (error is not null) throw error;
        return Ok(result);
    }

    [HttpGet("tenants")]
    public async Task<IActionResult> ListTenants(CancellationToken cancellationToken) =>
        Ok(await _service.ListTenantsAsync(cancellationToken));

    [HttpPut("tenants/{tenantId:guid}/status")]
    public async Task<IActionResult> UpdateTenantStatus(
        Guid tenantId,
        [FromBody] UpdatePlatformTenantStatusRequest request,
        CancellationToken cancellationToken)
    {
        var error = await _service.UpdateTenantStatusAsync(
            tenantId, request, RequireActorId(), HttpContext.TraceIdentifier, cancellationToken);
        if (error is not null) throw error;
        return Ok(new { suspended = request.Suspended });
    }

    [HttpGet("users")]
    public async Task<IActionResult> ListUsers(CancellationToken cancellationToken) =>
        Ok(await _service.ListUsersAsync(cancellationToken));

    [HttpPut("users/{userId:guid}/status")]
    public async Task<IActionResult> UpdateUserStatus(
        Guid userId,
        [FromBody] UpdatePlatformUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        var error = await _service.UpdateUserStatusAsync(
            userId, request, RequireActorId(), HttpContext.TraceIdentifier, cancellationToken);
        if (error is not null) throw error;
        return Ok(new { suspended = request.Suspended });
    }

    [HttpPost("tenants/{tenantId:guid}/subscriptions/activate")]
    public async Task<IActionResult> ActivateSubscription(
        Guid tenantId,
        [FromBody] ActivateSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.StartsAt is DateTime startsAt && startsAt > _clock.UtcNow)
        {
            throw new ServiceResultException(
                "ValidationError",
                "Future subscription scheduling is not supported safely yet. Activate the plan at its intended start time.");
        }

        var (error, result) = await _service.ActivateSubscriptionAsync(
            tenantId, request, RequireActorId(), HttpContext.TraceIdentifier, cancellationToken);
        if (error is not null) throw error;
        return Ok(result);
    }

    [HttpGet("tenants/{tenantId:guid}/usage")]
    public async Task<IActionResult> Usage(Guid tenantId, CancellationToken cancellationToken)
    {
        var result = await _service.RefreshUsageAsync(tenantId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("audit")]
    public async Task<IActionResult> Audit(
        [FromQuery] Guid? tenantId,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default) =>
        Ok(await _service.ListAuditAsync(tenantId, take, cancellationToken));

    private static void EnsureSupportedPackage(string package)
    {
        if (string.Equals(package, CommercialContract.GrandfatheredPackage, StringComparison.OrdinalIgnoreCase)
            || CommercialPackageCatalog.All.Any(item =>
                string.Equals(item.Package, package, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        throw new ServiceResultException(
            "ValidationError",
            "Package must be Teacher, TeacherPro, Academy, or a supported compatibility package.");
    }

    private Guid RequireActorId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(value, out var actorId)
            ? actorId
            : throw new ServiceResultException("Unauthorized", "User identity is invalid.");
    }
}
