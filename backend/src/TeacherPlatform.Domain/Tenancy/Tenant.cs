namespace TeacherPlatform.Domain.Tenancy;

/// <summary>
/// مساحة عمل (مستأجر). التحققات الأمنية على NormalizedSlug الفريد غير الحساس لحالة الأحرف.
/// </summary>
public sealed class Tenant
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Slug كما اختاره المستخدم (يُحفظ للعرض/الروابط).</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>نسخة مطبّعة (lower + trimmed + تبديل _ بـ -) — الفهرس الفريد عليها.</summary>
    public string NormalizedSlug { get; set; } = string.Empty;

    /// <summary>يُعيّن من المستخدم الحالي في السيرفر — لا يُقبل من طلب العميل.</summary>
    public Guid OwnerUserId { get; set; }

    public string CountryCode { get; set; } = string.Empty;

    public string Timezone { get; set; } = string.Empty;

    public string DefaultLocale { get; set; } = "ar";

    public TenantStatus Status { get; set; } = TenantStatus.Active;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<TenantMembership> Memberships { get; set; } = new List<TenantMembership>();

    public TenantSettings? Settings { get; set; }
}

public enum TenantStatus
{
    Active = 1,
    Suspended = 2
}

/// <summary>
/// تطبيع slug ليكون URL-safe وغير حساس لحالة الأحرف.
/// </summary>
public static class TenantSlugNormalizer
{
    public static string Normalize(string slug)
    {
        return (slug ?? string.Empty).Trim().ToLowerInvariant().Replace('_', '-');
    }

    public static bool IsUrlSafe(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return false;
        }

        foreach (var c in slug)
        {
            var ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_';
            if (!ok)
            {
                return false;
            }
        }

        return true;
    }
}
