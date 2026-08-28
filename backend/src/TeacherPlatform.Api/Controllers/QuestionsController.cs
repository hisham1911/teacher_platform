using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// نقاط الأسئلة ضمن مساحة عمل. قراءة: أي عضو نشط. كتابة: Owner/Teacher.
/// تعديل السؤال = إنشاء QuestionVersion جديدة Immutable عبر POST versions — لا PUT للنسخ.
/// التعديل بنسخة قديمة يعيد 409 (BaseVersion mismatch).
/// </summary>
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/questions")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class QuestionsController : ControllerBase
{
    private readonly QuestionService _questionService;
    private readonly BulkQuestionImportService _bulkImportService;

    public QuestionsController(
        QuestionService questionService,
        BulkQuestionImportService bulkImportService)
    {
        _questionService = questionService;
        _bulkImportService = bulkImportService;
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }

    /// <summary>قائمة الأسئلة مع البحث والمرشحات والترقيم الصفحي.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(PagedResponse<QuestionListItemResponse>), StatusCodes.Status200OK)]
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

    /// <summary>إنشاء سؤال مع Version رقم 1.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuestionDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateQuestionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest();
        }

        var (error, result) = await _questionService.CreateQuestionAsync(request, CurrentUserId(), cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, questionId = result!.Id }, result);
    }

    /// <summary>
    /// يحفظ مجموعة أسئلة راجعها المستخدم كعملية واحدة. عند استهداف نشاط،
    /// إنشاء الأسئلة وربطها بالمسودة يحدثان داخل نفس المعاملة أو يتم التراجع عن الكل.
    /// </summary>
    [HttpPost("bulk")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(BulkQuestionImportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> BulkCreate(
        [FromRoute] Guid tenantId,
        [FromBody] BulkQuestionImportRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var result = await _bulkImportService.ImportAsync(request, CurrentUserId(), cancellationToken);
        return Ok(result);
    }

    /// <summary>تفاصيل السؤال مع النسخة الحالية والوسوم.</summary>
    [HttpGet("{questionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(QuestionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        CancellationToken cancellationToken)
    {
        var result = await _questionService.GetQuestionAsync(questionId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>قائمة نسخ السؤال بترتيب تنازلي — لا تتضمن options.</summary>
    [HttpGet("{questionId:guid}/versions")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(IReadOnlyList<QuestionVersionSummaryResponse>), StatusCodes.Status200OK)]
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

        var items = await _questionService.ListVersionsAsync(questionId, cancellationToken);
        return Ok(items);
    }

    /// <summary>نسخة محددة مع options — للمعاينة وللمطالبات التاريخية.</summary>
    [HttpGet("{questionId:guid}/versions/{versionNumber:int}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(QuestionVersionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVersion(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid questionId,
        [FromRoute] int versionNumber,
        CancellationToken cancellationToken)
    {
        var result = await _questionService.GetVersionAsync(questionId, versionNumber, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// تعديل محتوى السؤال بإنشاء نسخة جديدة. إن كانت BaseVersion مختلفة عن الحالية → 409.
    /// </summary>
    [HttpPost("{questionId:guid}/versions")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuestionDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
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

        var (error, result) = await _questionService.CreateNewVersionAsync(questionId, request, CurrentUserId(), cancellationToken);
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

    /// <summary>أرشفة السؤال — إخفاء من القوائم الافتراضية دون حذف النسخ أو الوسائط.</summary>
    [HttpPost("{questionId:guid}/archive")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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
