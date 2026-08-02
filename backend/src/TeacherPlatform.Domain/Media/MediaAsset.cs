using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Media;

/// <summary>
/// سجل ملف وسائط مملوك لمستأجر. يخزّن ObjectKey فقط — لا Binary في PostgreSQL.
/// المسار الداخلي للتخزين لا يُعرض للواجهة أبدًا؛ رابط القراءة يُنشأ مؤقتًا عبر الـAPI.
/// </summary>
public sealed class MediaAsset : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>مفتاح التخزين الداخلي (مثل tenant-assets/{tenant}/questions/{asset}/original.png).</summary>
    public string ObjectKey { get; set; } = string.Empty;

    public string MimeType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public MediaKind Kind { get; set; }

    public MediaAssetStatus Status { get; set; } = MediaAssetStatus.Active;

    /// <summary>الاسم الأصلي الذي رفعه المستخدم (للعرض فقط — غير موثوق أمنيًا).</summary>
    public string OriginalFileName { get; set; } = string.Empty;

    public Guid CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public enum MediaKind
{
    Image = 1,
    Audio = 2
}

public enum MediaAssetStatus
{
    Active = 1,
    /// <summary>محجوز لحذف لاحق — وسائط مرتبطة بنسخ سؤال تاريخية لا تُحذف أبدًا.</summary>
    Orphaned = 2
}
