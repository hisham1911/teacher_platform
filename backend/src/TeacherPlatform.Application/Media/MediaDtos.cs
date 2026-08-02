namespace TeacherPlatform.Application.Media;

/// <summary>استجابة رفع وسائط — لا تحتوي أي مسار داخلي للتخزين.</summary>
public sealed class MediaAssetResponse
{
    public Guid Id { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string MimeType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    /// <summary>رابط قراءة مؤقت ينشئه الـAPI — يمر عبر GetContent endpoint وليس مسار تخزين خام.</summary>
    public string? DownloadUrl { get; set; }
}
