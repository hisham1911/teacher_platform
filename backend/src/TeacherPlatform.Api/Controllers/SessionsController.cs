using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// إدارة جلسات الاختبار (Teacher): إنشاء، قائمة، تفعيل، إنهاء، إلغاء.
/// كل العمليات تتطلب TenantContentManagement (Owner/Teacher).
/// جلسات Live تُدار بعد فتح Lobby من نقاط /live المخصصة.
/// </summary>
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/quizzes/{quizId:guid}/sessions")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.AuthenticatedUser)]
public sealed class SessionsController : ControllerBase
{
    private readonly SessionService _sessionService;
    private readonly ActivityLaunchService _activityLaunchService;

    public SessionsController(SessionService sessionService, ActivityLaunchService activityLaunchService)
    {
        _sessionService = sessionService;
        _activityLaunchService = activityLaunchService;
    }

    /// <summary>
    /// تجهيز نشاط للطلاب كعملية واحدة retry-safe: ينشر عند الحاجة، ينشئ جلسة،
    /// ويفعّل الأنماط الفردية. Live يبقى Scheduled حتى يضغط المعلم «ابدأ».
    /// </summary>
    [HttpPost("launch")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Launch(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] ActivityLaunchRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _activityLaunchService.LaunchAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>إنشاء جلسة جديدة على النسخة المنشورة الحالية للاختبار.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromBody] CreateSessionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _sessionService.CreateAsync(quizId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, quizId, sessionId = result!.Id }, result);
    }

    /// <summary>قائمة جلسات الاختبار مع ترقيم صفحي.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(PagedResponse<SessionListItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var result = await _sessionService.ListAsync(quizId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>تفاصيل جلسة مع المشاركين ومحاولاتهم.</summary>
    [HttpGet("{sessionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid sessionId,
        CancellationToken cancellationToken)
    {
        var result = await _sessionService.GetAsync(sessionId, cancellationToken);
        if (result is null || result.QuizId != quizId)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return Ok(result);
    }

    /// <summary>تفعيل الجلسة (Scheduled → Active) — يفتح الانضمام للطلاب.</summary>
    [HttpPost("{sessionId:guid}/activate")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Activate(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid sessionId,
        [FromBody] SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _sessionService.ActivateAsync(sessionId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        if (result!.QuizId != quizId)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return Ok(result);
    }

    /// <summary>إنهاء الجلسة (Active → Finished) — يغلق الانضمام ويُبقي النتائج.</summary>
    [HttpPost("{sessionId:guid}/finish")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Finish(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid sessionId,
        [FromBody] SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _sessionService.FinishAsync(sessionId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        if (result!.QuizId != quizId)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return Ok(result);
    }

    /// <summary>إلغاء الجلسة (Scheduled/Active → Cancelled).</summary>
    [HttpPost("{sessionId:guid}/cancel")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid quizId,
        [FromRoute] Guid sessionId,
        [FromBody] SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, result) = await _sessionService.CancelAsync(sessionId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        if (result!.QuizId != quizId)
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        return Ok(result);
    }
}
