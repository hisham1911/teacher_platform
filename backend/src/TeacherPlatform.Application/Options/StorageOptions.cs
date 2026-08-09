using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

/// <summary>إعدادات تخزين الوسائط. كل الحدود قابلة للإعداد بدون إعادة نشر.</summary>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>Local أو S3.</summary>
    [Required]
    public string Provider { get; set; } = "Local";

    /// <summary>الجذر المحلي للتطوير/الاختبارات — يُحل نسبيًا إلى ContentRoot.</summary>
    public string LocalRootPath { get; set; } = ".media-storage";

    // إعدادات S3 — مطلوبة فقط عندما Provider = S3
    public string? Endpoint { get; set; }

    public string? Bucket { get; set; }

    public string? AccessKey { get; set; }

    public string? SecretKey { get; set; }

    public string Region { get; set; } = "us-east-1";

    public bool ForcePathStyle { get; set; } = true;

    [Range(1, 60)]
    public int DownloadUrlExpiryMinutes { get; set; } = 5;

    // حدود الرفع
    [Range(1024, 50 * 1024 * 1024)]
    public long ImageMaxBytes { get; set; } = 5 * 1024 * 1024; // 5MB

    [Range(1024, 100 * 1024 * 1024)]
    public long AudioMaxBytes { get; set; } = 20 * 1024 * 1024; // 20MB
}
