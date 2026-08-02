using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Media;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

/// <summary>
/// نقاط الوسائط ضمن مساحة عمل. الرفع عبر multipart/form-data مع حدود وفحص محتوى.
/// التنزيل عبر stream محمي بعضوية فعالة — لا مسار داخلي ولا روابط موقعة دائمة للـLocal.
/// </summary>
[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/media")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class TenantMediaController : ControllerBase
{
    private readonly MediaService _mediaService;

    public TenantMediaController(MediaService mediaService)
    {
        _mediaService = mediaService;
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }

    /// <summary>رفع صورة أو ملف صوتي. الاستجابة تحتوي معرفًا فقط — ليس مسار تخزين.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(MediaAssetResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [RequestSizeLimit(25 * 1024 * 1024)] // غطاء Nginx/الوكيل العكسي المطلق — الحدود الدقيقة في الخدمة
    public async Task<IActionResult> Upload(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
        {
            return BadRequest(new ProblemDetails { Title = "Expected multipart/form-data.", Status = StatusCodes.Status400BadRequest });
        }

        var form = await Request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("file");
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ProblemDetails { Title = "A non-empty 'file' form field is required.", Status = StatusCodes.Status400BadRequest });
        }

        await using var stream = file.OpenReadStream();
        var (error, result) = await _mediaService.UploadAsync(
            tenantId,
            CurrentUserId(),
            stream,
            file.Length,
            file.ContentType,
            file.FileName,
            cancellationToken);

        if (error is not null)
        {
            if (error.ErrorCode == "FileTooLarge")
            {
                return StatusCode(StatusCodes.Status413PayloadTooLarge, new ProblemDetails
                {
                    Title = error.ErrorCode,
                    Detail = error.Message,
                    Status = StatusCodes.Status413PayloadTooLarge
                });
            }

            throw error;
        }

        var downloadPath = Url.Action(nameof(GetContent), new { tenantId, mediaId = result!.Id });
        return CreatedAtAction(nameof(GetMetadata), new { tenantId, mediaId = result!.Id }, new MediaAssetResponse
        {
            Id = result!.Id,
            Kind = result.Kind,
            MimeType = result.MimeType,
            SizeBytes = result.SizeBytes,
            OriginalFileName = result.OriginalFileName,
            CreatedAt = result.CreatedAt,
            DownloadUrl = downloadPath
        });
    }

    /// <summary>معلومات الوسيط لواجهة Preview — لا مسار داخلي.</summary>
    [HttpGet("{mediaId:guid}")]
    [ProducesResponseType(typeof(MediaAssetResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMetadata(Guid tenantId, Guid mediaId, CancellationToken cancellationToken)
    {
        var downloadPath = Url.Action(nameof(GetContent), new { tenantId, mediaId });
        var (error, result) = await _mediaService.GetAsync(tenantId, mediaId, downloadPath, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(result);
    }

    /// <summary>بث المحتوى — محمي بعضوية المستأجر الفعالة من الـMiddleware. لا يكشف المسار الداخلي.</summary>
    [HttpGet("{mediaId:guid}/content")]
    [Produces("application/octet-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContent(Guid tenantId, Guid mediaId, CancellationToken cancellationToken)
    {
        var (error, result) = await _mediaService.OpenReadAsync(tenantId, mediaId, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        var (asset, content) = result!.Value;
        return File(content, asset.MimeType, enableRangeProcessing: true);
    }
}
