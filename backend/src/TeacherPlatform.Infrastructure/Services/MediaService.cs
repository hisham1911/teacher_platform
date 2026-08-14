using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Media;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Media;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// رفع وتقديم الوسائط على مستوى المستأجر:
/// - فحص الحجم/الامتداد/MIME/Magic bytes قبل أي لمس للتخزين.
/// - ObjectKey GUID آمن معزول في tenant-assets/{tenantId}/...
/// - لا Binary في PostgreSQL — ObjectKey فقط.
/// - القراءة عبر Stream من الـAPI بعد تحقق العضوية (لا روابط موقعة دائمة للـLocal).
/// </summary>
public sealed class MediaService
{
    private readonly AppDbContext _db;
    private readonly IObjectStorage _storage;
    private readonly StorageOptions _options;
    private readonly PlanLimitResolver _planLimits;
    private static readonly string[] AllowedMimePrefixes = ["image/", "audio/"];

    public MediaService(
        AppDbContext db,
        IObjectStorage storage,
        IOptions<StorageOptions> options,
        PlanLimitResolver planLimits)
    {
        _db = db;
        _storage = storage;
        _options = options.Value;
        _planLimits = planLimits;
    }

    /// <summary>
    /// يرفع ملفًا كوسيط مستأجر. يقرأ الترويسة لفحص Magic bytes ثم يخزن.
    /// الملفات المرفوضة لا تترك أي أثر في التخزين ولا في قاعدة البيانات.
    /// </summary>
    public async Task<(ServiceResultException? Error, MediaAssetResponse? Result)> UploadAsync(
        Guid tenantId,
        Guid uploadedBy,
        Stream content,
        long sizeBytes,
        string? declaredMime,
        string? declaredFileName,
        CancellationToken cancellationToken)
    {
        var declaredName = Path.GetFileName(declaredFileName ?? string.Empty);

        Stream buffered;
        if (content.CanSeek && content.Position == 0)
        {
            buffered = content;
        }
        else
        {
            // نحتاج مرتين قراءة: مرة لفحص Magic bytes ومرة للتخزين — نخزن مؤقتًا في الذاكرة (حد أقصى 20MB صوتي)
            var limit = Math.Max(_options.ImageMaxBytes, _options.AudioMaxBytes) + 1;
            var ms = new MemoryStream();
            await content.CopyToAsync(ms, 81920, cancellationToken);
            if (ms.Length > limit)
            {
                return (new ServiceResultException("FileTooLarge", "File exceeds the maximum allowed size."), null);
            }
            ms.Position = 0;
            buffered = ms;
        }

        var validation = MediaFileValidator.TryValidate(
            sizeBytes > 0 ? sizeBytes : buffered.Length,
            declaredMime,
            declaredName,
            () => buffered,
            _options,
            out var result);

        if (!validation || result.Outcome is null)
        {
            var errorCode = result.ErrorCode ?? "UnsupportedMediaType";
            var message = errorCode switch
            {
                "EmptyFile" => "The uploaded file is empty.",
                "FileTooLarge" => $"File exceeds the allowed size (images ≤ {_options.ImageMaxBytes / (1024 * 1024)}MB, audio ≤ {_options.AudioMaxBytes / (1024 * 1024)}MB).",
                _ when string.Equals(Path.GetExtension(declaredName), ".wav", StringComparison.OrdinalIgnoreCase) =>
                    "Use MP3, M4A, or uncompressed PCM WAV audio.",
                _ => "Unsupported or unsafe file type."
            };
            return (new ServiceResultException(errorCode, message), null);
        }

        // تحقق MIME المعلن سابقًا أوسع منظومة — Magic bytes أثبت. للصور والصوت فقط.
        var mime = (declaredMime ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        if (mime.Length > 0 && !AllowedMimePrefixes.Any(p => mime.StartsWith(p, StringComparison.Ordinal)))
        {
            return (new ServiceResultException("UnsupportedMediaType", "Only image and audio files are allowed."), null);
        }

        var planLimits = await _planLimits.GetAsync(tenantId, cancellationToken);
        var currentStorageBytes = await _db.MediaAssets
            .Where(asset => asset.TenantId == tenantId)
            .SumAsync(asset => (long?)asset.SizeBytes, cancellationToken) ?? 0;
        if (currentStorageBytes + buffered.Length > planLimits.MaxStorageBytes)
        {
            return (new ServiceResultException("QuotaExceeded", "This workspace reached its storage limit."), null);
        }

        // طبيعة الوسيط للمسار: image -> questions, audio -> audio
        var kind = result.Outcome.Kind;
        var assetId = Guid.NewGuid();
        var objectKey = $"tenant-assets/{tenantId:D}/{(kind == MediaKind.Image ? "questions" : "audio")}/{assetId:N}/original{result.Outcome.SafeExtension}";

        buffered.Position = 0;
        await _storage.UploadAsync(objectKey, buffered, mime.Length > 0 ? mime : "application/octet-stream", cancellationToken);

        var now = DateTime.UtcNow;
        var entity = new MediaAsset
        {
            Id = assetId,
            TenantId = tenantId, // Guard: تم ضبط TenantContext مسبقًا من الـMiddleware
            ObjectKey = objectKey,
            MimeType = mime.Length > 0 ? mime : (kind == MediaKind.Image ? "image/*" : "audio/*"),
            SizeBytes = buffered.Length,
            Kind = kind,
            OriginalFileName = declaredName,
            CreatedBy = uploadedBy,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            _db.MediaAssets.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // رد عكسي — الملف المخزن يُحذف إن فشل حفظ السجل حتى لا يترك orphan غير مشار إليه
            try { await _storage.DeleteAsync(objectKey, cancellationToken); }
            catch { /* best-effort cleanup */ }
            throw;
        }

        return (null, ToResponse(entity, downloadUrl: null));
    }

    /// <summary>يحضر الوسيط مع رابط قراءة — يضمن أن الـMediaAsset يخص المستأجر الحالي.</summary>
    public async Task<(ServiceResultException? Error, MediaAssetResponse? Result)> GetAsync(
        Guid tenantId,
        Guid assetId,
        string? relativeDownloadPath,
        CancellationToken cancellationToken)
    {
        var asset = await _db.MediaAssets.SingleOrDefaultAsync(a => a.Id == assetId, cancellationToken);
        if (asset is null)
        {
            return (new ServiceResultException("NotFound", "Media not found."), null);
        }

        return (null, ToResponse(asset, relativeDownloadPath));
    }

    /// <summary>يفتح قراءة المحتوى — فقط إذا كان الوسيط موجودًا ضمن سياق المستأجر الحالي.</summary>
    public async Task<(ServiceResultException? Error, (MediaAsset Asset, Stream Content)? Result)> OpenReadAsync(
        Guid tenantId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        var asset = await _db.MediaAssets.SingleOrDefaultAsync(a => a.Id == assetId, cancellationToken);
        if (asset is null)
        {
            return (new ServiceResultException("NotFound", "Media not found."), null);
        }

        Stream content;
        try
        {
            content = await _storage.OpenReadAsync(asset.ObjectKey, cancellationToken);
        }
        catch (FileNotFoundException)
        {
            return (new ServiceResultException("NotFound", "Media content is missing from storage."), null);
        }

        return (null, (asset, content));
    }

    private static MediaAssetResponse ToResponse(MediaAsset asset, string? downloadUrl)
    {
        return new MediaAssetResponse
        {
            Id = asset.Id,
            Kind = asset.Kind.ToString(),
            MimeType = asset.MimeType,
            SizeBytes = asset.SizeBytes,
            OriginalFileName = asset.OriginalFileName,
            CreatedAt = asset.CreatedAt,
            DownloadUrl = downloadUrl
        };
    }

}
