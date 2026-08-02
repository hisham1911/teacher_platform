namespace TeacherPlatform.Domain.Tenancy;

/// <summary>
/// إعدادات مساحة العمل والعلامة. قيد فريد على TenantId (واحد لواحد).
/// SettingsJson لتوسعات البيانات الدينية — لا يحتوي علاقات أساسية.
/// </summary>
public sealed class TenantSettings
{
    public Guid TenantId { get; set; }

    public string? LogoObjectKey { get; set; }

    public string? PrimaryColor { get; set; }

    public string? SecondaryColor { get; set; }

    public string? PublicTeacherName { get; set; }

    public string? CertificateSignatureObjectKey { get; set; }

    /// <summary>إعدادات موسعة (Limitations/Theme/...) بصيغة JSONB.</summary>
    public string SettingsJson { get; set; } = "{}";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Tenant? Tenant { get; set; }
}
