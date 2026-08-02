using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/question-tags")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class QuestionTagsController : ControllerBase
{
    private readonly QuestionService _questionService;

    public QuestionTagsController(QuestionService questionService)
    {
        _questionService = questionService;
    }

    /// <summary>قائمة الوسوم — تُنشأ تلقائيًا مع الأسئلة (لا endpoint إنشاء منفصل في MVP).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<QuestionTagResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromRoute] Guid tenantId, CancellationToken cancellationToken)
    {
        var items = await _questionService.ListTagsAsync(cancellationToken);
        return Ok(items);
    }
}
