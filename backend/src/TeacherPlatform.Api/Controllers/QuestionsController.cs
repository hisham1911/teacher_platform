using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/questions")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class QuestionsController : ControllerBase
{
    private readonly QuestionService _questionService;
    private readonly BulkQuestionImportService _bulkImportService;
    private readonly CommercialPolicyService _commercial;

    public QuestionsController(
        QuestionService questionService,
        BulkQuestionImportService bulkImportService,
        CommercialPolicyService commercial)
    {
        _questionService = questionService;
        _bulkImportService = bulkImportService;
        _commercial = commercial;
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        [FromQuery] Guid? bankId,
        [FromQuery] string? type,
        [FromQuery] string? difficulty,
        [FromQuery] string? tag,
        [FromQuery] string? search,
        [FromQuery] bool includeArchived,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var result = await _questionService.ListQuestionsAsync(new QuestionListQuery
        {
            BankId = bankId,
            Type = type,
            Difficulty = difficulty,
            Tag = tag,
            Search = search,
            IncludeArchived = includeArchived ? true : null,
            Page = page,
            PageSize = pageSize
        }, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateQuestionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _questionService.CreateQuestionAsync(
            request,
            CurrentUserId(),
            cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, questionId = result!.Id }, result);
    }

    [HttpPost("bulk")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    public async Task<IActionResult> BulkCreate(
        [FromRoute] Guid tenantId,
        [FromBody] BulkQuestionImportRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        await _commercial.RequireEntitlementAsync(
            tenantId,
            CommercialEntitlements.BulkImport,
            cancellationToken);
        var result = await _bulkImportService.ImportAsync(
            request,
            CurrentUserId(),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("{questionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        CancellationToken cancellationToken)
    {
        var result = await _questionService.GetQuestionAsync(questionId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{questionId:guid}/versions")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    public async Task<IActionResult> ListVersions(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        CancellationToken cancellationToken)
    {
        var exists = await _questionService.GetQuestionAsync(questionId, cancellationToken);
        if (exists is null)
        {
            return NotFound();
        }

        return Ok(await _questionService.ListVersionsAsync(questionId, cancellationToken));
    }

    [HttpGet("{questionId:guid}/versions/{versionNumber:int}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    public async Task<IActionResult> GetVersion(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        [FromRoute] int versionNumber,
        CancellationToken cancellationToken)
    {
        var result = await _questionService.GetVersionAsync(
            questionId,
            versionNumber,
            cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{questionId:guid}/versions")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    public async Task<IActionResult> CreateNewVersion(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        [FromBody] CreateQuestionVersionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _questionService.CreateNewVersionAsync(
            questionId,
            request,
            CurrentUserId(),
            cancellationToken);
        if (error is not null)
        {
            if (error.ErrorCode == "Conflict")
            {
                return Conflict(new ProblemDetails
                {
                    Title = "Conflict",
                    Detail = error.Message,
                    Status = StatusCodes.Status409Conflict
                });
            }

            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, questionId }, result);
    }

    [HttpPost("{questionId:guid}/archive")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    public async Task<IActionResult> Archive(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        CancellationToken cancellationToken)
    {
        var error = await _questionService.ArchiveQuestionAsync(questionId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return NoContent();
    }
}
