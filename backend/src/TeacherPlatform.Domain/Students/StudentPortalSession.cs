using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Students;

/// <summary>
/// جلسة دخول دائمة للطالب إلى English Spark، منفصلة تمامًا عن Guest Token الخاص بنشاط واحد.
/// الرمز الخام يعيش فقط في HttpOnly cookie؛ قاعدة البيانات تحتفظ بالـhash.
/// </summary>
public sealed class StudentPortalSession : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StudentId { get; set; }
    public Guid CredentialId { get; set; }

    /// <summary>SHA-256 hex لرمز الجلسة الخام.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Student? Student { get; set; }
    public StudentPortalCredential? Credential { get; set; }
}
