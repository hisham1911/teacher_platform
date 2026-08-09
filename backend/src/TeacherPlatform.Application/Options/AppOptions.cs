using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

/// <summary>خيارات JWT مع تحقق صارم عبر IValidateOptions.</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; set; } = string.Empty;

    [Required]
    public string Audience { get; set; } = string.Empty;

    /// <summary>مفتاح التوقيع — من Environment/Secret store فقط، ولا يُخزن في الملفات المتتبعة.</summary>
    [Required]
    [MinLength(32)]
    public string SigningKey { get; set; } = string.Empty;

    [Range(5, 60)]
    public int AccessTokenMinutes { get; set; } = 15;

    [Range(0, 5)]
    public int ClockSkewMinutes { get; set; } = 1;
}

/// <summary>خيارات الجلسة والتحديث والكوكي.</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    [Range(1, 365)]
    public int RefreshTokenDays { get; set; } = 30;

    /// <summary>تفعيل Secure للكوكي — إلزامي true في Production.</summary>
    public bool UseSecureCookie { get; set; }

    /// <summary>Lax أو Strict أو None. None تتطلب Secure.</summary>
    [Required]
    public string CookieSameSite { get; set; } = "Strict";

    /// <summary>قائمة الـOrigins الموثوقة لفحص Origin في العمليات القائمة على الكوكي.</summary>
    public string[] TrustedOrigins { get; set; } = [];

    /// <summary>الرابط الأساسي لبناء روابط تأكيد البريد/إعادة التعيين.</summary>
    [Required]
    public string WebBaseUrl { get; set; } = "http://localhost:5173";
}

/// <summary>أسباب حظر الحساب ومهل قفل المحاولات الفاشلة.</summary>
public sealed class IdentityLockoutOptions
{
    public const string SectionName = "IdentityLockout";

    [Range(1, 20)]
    public int MaxFailedAccessAttempts { get; set; } = 5;

    [Range(1, 120)]
    public int DefaultLockoutMinutes { get; set; } = 15;
}

/// <summary>خيارات البريد: File للتطوير/E2E، وSMTP للإنتاج.</summary>
public sealed class MailOptions
{
    public const string SectionName = "Mail";

    [Required]
    public string Provider { get; set; } = "File";

    /// <summary>مجلد تحميل رسائل Development. يجب أن يكون خارج المستودع.</summary>
    [Required]
    public string DevDropDirectory { get; set; } = ".dev-mail";

    public string? Host { get; set; }

    [Range(1, 65535)]
    public int Port { get; set; } = 587;

    public string? Username { get; set; }

    public string? Password { get; set; }

    [Required]
    public string Security { get; set; } = "StartTls";

    [EmailAddress]
    public string? FromAddress { get; set; }

    [StringLength(120)]
    public string FromName { get; set; } = "Teacher Platform";
}

/// <summary>خيارات مفاتيح Data Protection.</summary>
public sealed class DataProtectionSettings
{
    public const string SectionName = "DataProtection";

    /// <summary>
    /// مسار دائم خارج مجلد الإصدار في Production؛ Development والاختبارات تستخدم مسارًا مؤقتًا آمنًا.
    /// فارغ = إنشاء مجلد تحت المجلد المؤقت للنظام.
    /// </summary>
    public string? KeysDirectory { get; set; }

    [Required]
    public string ApplicationName { get; set; } = "TeacherPlatform";
}

/// <summary>حدود معدل الطلبات على نقاط المصادقة الحساسة.</summary>
public sealed class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    [Range(1, 10_000)]
    public int PermitLimit { get; set; } = 20;

    [Range(1, 3600)]
    public int WindowSeconds { get; set; } = 60;
}
