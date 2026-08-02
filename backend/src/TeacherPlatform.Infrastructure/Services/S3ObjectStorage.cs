using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// تنفيذ S3-compatible لمخزن الإنتاج. يتطلب من تشغيل Production ضبط
/// Storage:Endpoint/Bucket/AccessKey/SecretKey من Secret store فقط.
/// الاعتماد الفعلي على AWSSDK.S3 غير مجمّع حتى التفعيل الإنتاجي — حالياً Fail-fast
/// بدل السلوك الصامت الخاطئ. أنشئ Issue لتفعيله عند الإضافة الحقيقية.
/// </summary>
public sealed class S3ObjectStorage : IObjectStorage
{
    public S3ObjectStorage(StorageOptions options)
    {
        // fail-fast في Production حتى لا يعمل بلا رسول حقيقي
        throw new InvalidOperationException(
            "S3 storage provider is configured but not yet implemented. " +
            "Install the S3 SDK and wire credentials securely before enabling Provider=S3.");
    }

    public Task UploadAsync(string objectKey, Stream content, string contentType, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();

    public Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();

    public Task<bool> ExistsAsync(string objectKey, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
}
