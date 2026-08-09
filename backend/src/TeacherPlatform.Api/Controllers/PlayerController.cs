using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Infrastructure.Services;
using SessionOptions = TeacherPlatform.Application.Options.SessionOptions;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// واجهة اللاعب المجهول (Student Player): انضمام برمز الجلسة، بدء محاولة، جلب السؤال الحالي،
/// تسجيل الإجابات، الإنهاء، وعرض النتيجة.
///
/// الأمان:
/// - لا JWT ولا حساب — الهوية عبر رمز ضيف 256-bit عشوائي يُخزَّن هاشه فقط في القاعدة.
/// - الرمز الخام يُرسل للعميل مرة واحدة عند الانضمام ويُحفظ في كوكي HttpOnly (لا يصل إليه JS).
/// - أسماء الكوكي: Production `__Host-tp-guest` (Secure إلزامي)، Development `tp-guest`.
/// - Rate limiting مستقل (PlayerEndpoints) بنفس نافذة إعدادات RateLimiting.
/// - لا يُسجَّل الرمز الخام ولا الهاش في أي Log.
/// </summary>
[ApiController]
[Route("api/v1/player/sessions")]
[Produces("application/json")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class PlayerController : ControllerBase
{
    // __Host- prefix يفرض Secure=true عند المتصفحات — نستخدمه فقط مع كوكي Secure (Production).
    private static string ResolveCookieName(AuthOptions options) => GuestTokenService.ResolveCookieName(options.UseSecureCookie);

    private readonly PlayerService _playerService;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IOptions<SessionOptions> _sessionOptions;

    public PlayerController(
        PlayerService playerService,
        IOptions<AuthOptions> authOptions,
        IOptions<SessionOptions> sessionOptions)
    {
        _playerService = playerService;
        _authOptions = authOptions;
        _sessionOptions = sessionOptions;
    }

    /// <summary>معلومات الجلسة العامة قبل الانضمام — metadata فقط، لا أسئلة ولا خيارات.</summary>
    [HttpGet("{joinCode}")]
    [ProducesResponseType(typeof(PlayerSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetByJoinCode(
        [FromRoute] string joinCode,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _playerService.GetByJoinCodeAsync(joinCode, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>
    /// استعادة حالة اللاعب من الكوكي فقط — للاستئناف بعد إعادة التحميل بدون localStorage.
    /// الاسم والوجهة (استئناف/نتيجة/بدء) مصدرهما السيرفر فقط عبر نفس شكل JoinSessionResponse.
    /// </summary>
    [HttpGet("{joinCode}/me")]
    [ProducesResponseType(typeof(JoinSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetCurrentPlayer(
        [FromRoute] string joinCode,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.GetCurrentPlayerAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>
    /// انضمام طالب باسم عرض (2-50 حرفًا). Idempotent: نفس الكوكي الصالح يعيد نفس المشارك.
    /// عند الانضمام الجديد يُضبط كوكي ضيف HttpOnly بالرمز الخام.
    /// </summary>
    [HttpPost("{joinCode}/join")]
    [ProducesResponseType(typeof(JoinSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Join(
        [FromRoute] string joinCode,
        [FromBody] JoinSessionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var existingToken = ReadGuestToken();
        var (error, result, rawToken) = await _playerService.JoinAsync(
            joinCode, request, existingToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        // رمز خام جديد ⇒ انضمام جديد — نضبط الكوكي. إعادة الانضمام تعيد null ولا نلمس الكوكي.
        if (!string.IsNullOrEmpty(rawToken))
        {
            SetGuestCookie(rawToken);
        }

        return Ok(result);
    }

    /// <summary>بدء محاولة (أو استئناف الموجودة بعد F5). يتطلب كوكي ضيف صالحًا.</summary>
    [HttpPost("{joinCode}/attempts")]
    [ProducesResponseType(typeof(StartAttemptResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> StartAttempt(
        [FromRoute] string joinCode,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.StartAttemptAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>السؤال الحالي بصيغة آمنة (بدون IsCorrect ولا إجابات مقبولة) مع خيارات مخلوطة حتميًا.</summary>
    [HttpGet("{joinCode}/attempts/{attemptId:guid}/current-question")]
    [ProducesResponseType(typeof(PlayerQuestionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetCurrentQuestion(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.GetCurrentQuestionAsync(
            joinCode, attemptId, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>
    /// تسجيل إجابة مع تصحيح فوري على الخادم.
    /// Idempotent: نفس الإجابة تُعاد؛ إجابة مختلفة لنفس السؤال ⇒ 409 AnswerConflict.
    /// </summary>
    [HttpPost("{joinCode}/attempts/{attemptId:guid}/answers")]
    [ProducesResponseType(typeof(SubmitAnswerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SubmitAnswer(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        [FromBody] SubmitAnswerRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.SubmitAnswerAsync(
            joinCode, attemptId, request, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>إنهاء المحاولة. Idempotent: المحاولة المنتهية تُعيد نتيجتها الحالية.</summary>
    [HttpPost("{joinCode}/attempts/{attemptId:guid}/finish")]
    [ProducesResponseType(typeof(FinishAttemptResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Finish(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.FinishAsync(joinCode, attemptId, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>نتيجة المحاولة — للطالب صاحب رمز الضيف فقط.</summary>
    [HttpGet("{joinCode}/attempts/{attemptId:guid}/result")]
    [ProducesResponseType(typeof(AttemptResultResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetResult(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.GetResultAsync(joinCode, attemptId, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>
    /// بث وسيط سؤال خاص — يتطلب كوكي ضيف صالحًا ومحاولة مملوكة له، والوسيط يجب أن يكون
    /// مرتبطًا بسؤال ضمن نسخة الجلسة. لا يكشف المسار الداخلي ولا يعمل كـoracle لوسائط المستأجر.
    /// </summary>
    [HttpGet("{joinCode}/attempts/{attemptId:guid}/media/{mediaId:guid}")]
    [Produces("application/octet-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetQuestionMedia(
        [FromRoute] string joinCode,
        [FromRoute] Guid attemptId,
        [FromRoute] Guid mediaId,
        CancellationToken cancellationToken)
    {
        var rawToken = RequireGuestToken();
        var (error, result) = await _playerService.OpenQuestionMediaAsync(
            joinCode, attemptId, mediaId, rawToken, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        var (asset, content) = result!.Value;
        return File(content, asset.MimeType, enableRangeProcessing: true);
    }

    // ---------- Cookie helpers ----------

    private string? ReadGuestToken()
    {
        var cookieName = ResolveCookieName(_authOptions.Value);
        return Request.Cookies.TryGetValue(cookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken)
            ? rawToken
            : null;
    }

    private string RequireGuestToken()
    {
        var rawToken = ReadGuestToken();
        if (string.IsNullOrEmpty(rawToken))
        {
            throw new TeacherPlatform.Application.Abstractions.ServiceResultException(
                "Unauthorized", "Guest token cookie is missing.");
        }

        return rawToken;
    }

    private void SetGuestCookie(string rawToken)
    {
        var options = _authOptions.Value;
        Response.Cookies.Append(ResolveCookieName(options), rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = options.UseSecureCookie,
            SameSite = ResolveSameSite(options),
            // Path=/ حتى تُرفق الكوكي بكل مسارات player API ضمن نفس Host.
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(_sessionOptions.Value.GuestTokenDays),
            IsEssential = true
        });
    }

    /// <summary>
    /// حذف كوكي الضيف العالق يكون مسؤولية GlobalExceptionHandler (بعد كتابة الاستجابة الفعلية) —
    /// عند Unauthorized على مسارات player يُحذف الكوكي بنفس الاسم والسمات.
    /// </summary>
    private static SameSiteMode ResolveSameSite(AuthOptions options) => options.CookieSameSite switch
    {
        "Lax" => SameSiteMode.Lax,
        "None" => SameSiteMode.None,
        _ => SameSiteMode.Strict
    };
}
