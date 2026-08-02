using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/question-banks")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class QuestionBanksController : ControllerBase
{
    private readonly QuestionService _questionService;

    public QuestionBanksController(QuestionService questionService)
    {
        _questionService = questionService;
    }

    /// <summary>قائمة البنوك مع عدد الأسئلة الفعالة — لأي عضو نشط.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(IReadOnlyList<QuestionBankResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromRoute] Guid tenantId, CancellationToken cancellationToken)
    {
        var items = await _questionService.ListBanksAsync(cancellationToken);
        return Ok(items);
    }

    /// <summary>إنشاء بنك — Owner أو Teacher فقط (إدارة المحتوى).</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuestionBankResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateQuestionBankRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _questionService.CreateBankAsync(request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(List), new { tenantId }, result);
    }

    /// <summary>تعديل بنك — Owner أو Teacher فقط.</summary>
    [HttpPatch("{bankId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid bankId,
        [FromBody] UpdateQuestionBankRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var error = await _questionService.UpdateBankAsync(bankId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return NoContent();
    }
}
