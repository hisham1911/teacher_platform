using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Application.Abstractions;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/system")]
public sealed class SystemInfoController(IClock clock) : ControllerBase
{
    [HttpGet("info")]
    [ProducesResponseType(typeof(SystemInfoResponse), StatusCodes.Status200OK)]
    public IActionResult Get()
    {
        return Ok(new SystemInfoResponse(
            Service: "teacher-platform-api",
            Status: "ok",
            ApiVersion: "v1",
            ServerTimeUtc: clock.UtcNow));
    }
}
