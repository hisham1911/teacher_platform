using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Api.Middleware;
using TeacherPlatform.Application.Auth;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class TenantsController : ControllerBase
{
    private readonly TenantService _tenantService;
    private readonly TenantBypassService _bypass;

    public TenantsController(TenantService tenantService, TenantBypassService bypass)
    {
        _tenantService = tenantService;
        _bypass = bypass;
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }

    /// <summary>
    /// دور المستخدم في مستأجر محدد — صريح وسريع. لايعتمد على Query Filters
    /// لأنها عبر TenantBypassService بشكل مركزي.
    /// </summary>
    private TenantMemberRole? CurrentMyRole(Guid tenantId, Guid userId, CancellationToken ct)
    {
        return _bypass.GetActiveMemberRoleIgnoreFiltersAsync(tenantId, userId, ct).GetAwaiter().GetResult();
    }

    /// <summary>إنشاء Workspace — في معاملة واحدة (Tenant + Owner Membership + Settings).</summary>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.AuthEndpoints)]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _tenantService.CreateTenantAsync(request, CurrentUserId(), cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId = result!.Id }, result);
    }

    /// <summary>قائمة Workspaces التي للمستخدم عضوية نشطة فيها.</summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantDetailResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Mine(CancellationToken cancellationToken)
    {
        var items = await _tenantService.ListMineAsync(CurrentUserId(), cancellationToken);
        return Ok(items);
    }

    /// <summary>تفاصيل Workspace — يتطلب عضوية نشطة (الميدلوير حلّ السياق).</summary>
    [HttpGet("{tenantId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid tenantId, CancellationToken cancellationToken)
    {
        var myRole = CurrentMyRole(tenantId, CurrentUserId(), cancellationToken) ?? TenantMemberRole.Viewer;
        var result = await _tenantService.GetAsync(tenantId, myRole, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>تعديل اسم/slug — Owner فقط.</summary>
    [HttpPatch("{tenantId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantOwner)]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid tenantId, [FromBody] UpdateTenantRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var myRole = CurrentMyRole(tenantId, CurrentUserId(), cancellationToken) ?? TenantMemberRole.Viewer;
        var (error, result) = await _tenantService.UpdateAsync(tenantId, request, myRole, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>قائمة الأعضاء — أي عضو نشط يقرأها.</summary>
    [HttpGet("{tenantId:guid}/members")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(IReadOnlyList<TenantMemberDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMembers(Guid tenantId, CancellationToken cancellationToken)
    {
        var items = await _tenantService.ListMembersAsync(tenantId, cancellationToken);
        return Ok(items);
    }

    /// <summary>إضافة عضو — Owner فقط؛ لا يمكن منح Owner أو PlatformAdmin.</summary>
    [HttpPost("{tenantId:guid}/members")]
    [Authorize(Policy = AuthorizationPolicies.TenantMemberManagement)]
    [ProducesResponseType(typeof(TenantMemberDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> AddMember(Guid tenantId, [FromBody] AddTenantMemberRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _tenantService.AddMemberAsync(tenantId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(ListMembers), new { tenantId }, result);
    }

    /// <summary>قراءة الإعدادات — أي عضو نشط.</summary>
    [HttpGet("{tenantId:guid}/settings")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(TenantSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _tenantService.GetSettingsAsync(tenantId, cancellationToken);
        return settings is null ? NotFound() : Ok(settings);
    }

    /// <summary>تعديل الإعدادات — Owner فقط.</summary>
    [HttpPatch("{tenantId:guid}/settings")]
    [Authorize(Policy = AuthorizationPolicies.TenantSettingsManagement)]
    [ProducesResponseType(typeof(TenantSettingsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSettings(Guid tenantId, [FromBody] UpdateTenantSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _tenantService.UpdateSettingsAsync(tenantId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }
}
