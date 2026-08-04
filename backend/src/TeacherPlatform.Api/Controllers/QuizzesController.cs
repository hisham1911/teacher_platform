using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Quizzes;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// نقاط الاختبارات ضمن مساحة عمل. قراءة: أي عضو نشط. كتابة/نشر: Owner/Teacher.
/// النشر ينشئ نسخة Immutable جديدة ويجمّد المسودة — لا تعديل على المنشور.
/// التعديل بنسخة قديمة يعيد 409 (BaseVersion mismatch).
/// </summary>
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/quizzes")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class QuizzesController : ControllerBase
{
    private readonly QuizService _quizService;

    public QuizzesController(QuizService quizService)
    {
        _quizService = quizService;
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }

    /// <summary>قائمة الاختبارات مع البحث ومرشح الحالة والترقيم الصفحي.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(PagedResponse<QuizListItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var result = await _quizService.ListQuizzesAsync(new QuizListQuery
        {
            Status = status,
            Search = search,
            Page = page,
            PageSize = pageSize
        }, cancellationToken);

        return Ok(result);
    }

    /// <summary>إنشاء اختبار مع مسودة Version رقم 1.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateQuizRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.CreateQuizAsync(request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, quizId = result!.Id }, result);
    }

    /// <summary>تفاصيل الاختبار.</summary>
    [HttpGet("{quizId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(QuizDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var result = await _quizService.GetQuizAsync(quizId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>تحديث الحقول الأساسية للاختبار (العنوان/الوصف/Slug).</summary>
    [HttpPatch("{quizId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] UpdateQuizRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.UpdateQuizAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>أرشفة الاختبار — تحدّث Status فقط ولا تمس النسخ.</summary>
    [HttpPost("{quizId:guid}/archive")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Archive(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var error = await _quizService.ArchiveQuizAsync(quizId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return NoContent();
    }

    // ---------- Draft editing ----------

    /// <summary>جلب المسودة الحالية مع كل العناصر ولقطات الأسئلة المثبتة.</summary>
    [HttpGet("{quizId:guid}/draft")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDraft(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _quizService.GetDraftAsync(quizId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>تحديث إعدادات المسودة (العنوان/التعليمات/الوقت/السمة/نسبة النجاح).</summary>
    [HttpPut("{quizId:guid}/draft")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateDraft(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] UpdateDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.UpdateDraftAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>إضافة سؤال إلى المسودة — يثبّت النسخة الحالية من السؤال.</summary>
    [HttpPost("{quizId:guid}/draft/items")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddItem(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] AddQuizItemRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.AddItemAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>تحديث نقاط/إلزامية عنصر في المسودة.</summary>
    [HttpPatch("{quizId:guid}/draft/items/{itemId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateItem(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid itemId,
        [FromBody] UpdateQuizItemRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.UpdateItemAsync(quizId, itemId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>حذف عنصر من المسودة وإعادة ترقيم الترتيب.</summary>
    [HttpDelete("{quizId:guid}/draft/items/{itemId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveItem(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid itemId,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _quizService.RemoveItemAsync(quizId, itemId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>إعادة ترتيب عناصر المسودة — يجب أن تطابق المعرفات كل العناصر تمامًا.</summary>
    [HttpPut("{quizId:guid}/draft/items/order")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderItems(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] ReorderItemsRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.ReorderItemsAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>
    /// GAP-C: تثبيت العنصر على أحدث نسخة من السؤال المصدر (مسودة فقط).
    /// يتطلب BaseVersion مطابقًا لـxmin المسودة — mismatch ⇒ 409.
    /// </summary>
    [HttpPost("{quizId:guid}/draft/items/{itemId:guid}/use-latest-version")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UseLatestQuestionVersion(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid itemId,
        [FromBody] UseLatestQuestionVersionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.UseLatestQuestionVersionAsync(quizId, itemId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    // ---------- Preview & Versions ----------

    /// <summary>معاينة المعلّم — محتوى المسودة الكامل مع معلومات التصحيح. لا ينشئ أي محاولة.</summary>
    [HttpGet("{quizId:guid}/preview")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizDraftResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPreview(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _quizService.GetPreviewAsync(quizId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>قائمة نسخ الاختبار بترتيب تنازلي.</summary>
    [HttpGet("{quizId:guid}/versions")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(IReadOnlyList<QuizVersionSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListVersions(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var result = await _quizService.ListVersionsAsync(quizId, cancellationToken);
        return Ok(result);
    }

    /// <summary>نسخة منشورة كاملة برقمها — للمعاينة والعرض. Immutable.</summary>
    [HttpGet("{quizId:guid}/versions/{versionNumber:int}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(QuizPublishedVersionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVersion(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] int versionNumber,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _quizService.GetVersionAsync(quizId, versionNumber, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    // ---------- Publish & Share ----------

    /// <summary>نشر المسودة الحالية — ينشئ نسخة Immutable ويجمّدها وينشئ مسودة جديدة.</summary>
    [HttpPost("{quizId:guid}/publish")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(PublishQuizResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Publish(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] PublishQuizRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _quizService.PublishAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>بيانات المشاركة العامة للاختبار (الرمز العام ورابط المشاركة).</summary>
    [HttpGet("{quizId:guid}/share")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(QuizShareResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetShare(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        CancellationToken cancellationToken)
    {
        var result = await _quizService.GetShareAsync(quizId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
