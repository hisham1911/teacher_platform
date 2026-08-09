using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/public/results")]
[Produces("application/json")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PlayerEndpoints)]
public sealed class PublicResultsController : ControllerBase
{
    private readonly ParentShareService _parentShareService;

    public PublicResultsController(ParentShareService parentShareService)
    {
        _parentShareService = parentShareService;
    }

    [HttpGet("{publicToken}")]
    [ProducesResponseType(typeof(PublicResultResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] string publicToken,
        CancellationToken cancellationToken)
    {
        var (error, result) = await _parentShareService.GetPublicAsync(publicToken, cancellationToken);
        if (error is not null) throw error;
        return Ok(result);
    }
}
