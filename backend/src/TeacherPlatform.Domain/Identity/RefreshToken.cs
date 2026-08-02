namespace TeacherPlatform.Domain.Identity;

/// <summary>
/// جلسة Refresh. لا يُخزّن أبدًا الرمز الخام — التجزئة فقط.
/// التدوير: عند كل استخدام يُستبدل الرمز ويُربط القديم بالجديد عبر ReplacedByTokenId.
/// كشف إعادة الاستخدام: استخدام رمز مستبدل يؤدي إلى إلغاء العائلة كاملة.
/// </summary>
public sealed class RefreshToken
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>SHA-256 للرمز الخام. لا يخزن الرمز الخام أبدًا.</summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>معرف عائلة التدوير — كل التدويرات المتسلسلة من نفس تسجيل الدخول.</summary>
    public Guid FamilyId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>وقت الإلغاء عند الاستبدال/تسجيل الخروج/كشف إعادة الاستخدام.</summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>معرف الرمز الذي حل محل هذا الرمز عند التدوير.</summary>
    public Guid? ReplacedByTokenId { get; set; }

    public string? CreatedByIp { get; set; }

    public string? UserAgent { get; set; }

    /// <summary>سبب الإلغاء عند الحاجة للتدقيق.</summary>
    public string? RevokedReason { get; set; }

    public ApplicationUser? User { get; set; }
}
