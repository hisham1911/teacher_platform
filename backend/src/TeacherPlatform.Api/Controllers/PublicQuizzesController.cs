using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Application.Quizzes;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// نقطة عامة مجهولة لصفحة الاختبار المنشور — بيانات آمنة فقط.
/// لا أسئلة ولا إجابات ولا درجات ولا تفاصيل مستأجر داخلية.
/// </summary>
[ApiController]
[Route("api/v1/public/quizzes")]
[Produces("application/json")]
public sealed class PublicQuizzesController : ControllerBase
{
    private readonly QuizService _quizService;

    public PublicQuizzesController(QuizService quizService)
    {
        _quizService = quizService;
    }

    /// <summary>بيانات الصفحة العامة للاختبار المنشور بالرمز العام.</summary>
    [HttpGet("{publicCode}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicQuizPageResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByCode(
        [FromRoute] string publicCode,
        CancellationToken cancellationToken)
    {
        var result = await _quizService.GetPublicByCodeAsync(publicCode, cancellationToken);
        return Ok(result);
    }
}
