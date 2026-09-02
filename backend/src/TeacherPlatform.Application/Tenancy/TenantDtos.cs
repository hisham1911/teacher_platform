using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Tenancy;

public sealed class CreateTenantRequest
{
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [Required, StringLength(40, MinimumLength = 3)] public string Slug { get; set; } = string.Empty;
    [Required, StringLength(2, MinimumLength = 2)] public string CountryCode { get; set; } = string.Empty;
    [Required, StringLength(40)] public string Timezone { get; set; } = string.Empty;
    [Required, StringLength(10)] public string DefaultLocale { get; set; } = "ar";
}

public sealed class UpdateTenantRequest
{
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [Required, StringLength(40, MinimumLength = 3)] public string Slug { get; set; } = string.Empty;
}

public sealed class TenantDetailResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string Timezone { get; set; } = string.Empty;
    public string DefaultLocale { get; set; } = "ar";
    public string Status { get; set; } = string.Empty;
    public string MyRole { get; set; } = string.Empty;
    public TenantSettingsResponse Settings { get; set; } = new();
}

public sealed class TenantMemberDto
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public sealed class AddTenantMemberRequest
{
    [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = string.Empty;
    [Required, StringLength(40)] public string Role { get; set; } = string.Empty;
}

public sealed class TenantSettingsResponse
{
    public string? LogoObjectKey { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? PublicTeacherName { get; set; }
    public string? CertificateSignatureObjectKey { get; set; }

    // Controlled Phase 4 branding fields. They are persisted inside SettingsJson, never interpreted as HTML/CSS.
    public string? BrandDisplayName { get; set; }
    public string? StudentPortalWelcomeText { get; set; }
    public string? SupportContact { get; set; }

    // Kept for backward compatibility. New UI must use typed settings fields rather than editing raw JSON.
    public string SettingsJson { get; set; } = "{}";
}

public sealed class UpdateTenantSettingsRequest
{
    [StringLength(500)] public string? LogoObjectKey { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$", ErrorMessage = "PrimaryColor must be a hex color like #0ea5e9")]
    public string? PrimaryColor { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$", ErrorMessage = "SecondaryColor must be a hex color like #f59e0b")]
    public string? SecondaryColor { get; set; }
    [StringLength(120)] public string? PublicTeacherName { get; set; }
    [StringLength(500)] public string? CertificateSignatureObjectKey { get; set; }

    [StringLength(120)] public string? BrandDisplayName { get; set; }
    [StringLength(280)] public string? StudentPortalWelcomeText { get; set; }
    [StringLength(160)] public string? SupportContact { get; set; }

    /// <summary>Backward-compatible raw JSON. Valid JSON object only; executable/style payloads are rejected.</summary>
    [StringLength(4000)] public string? SettingsJson { get; set; }
}
