using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Students;

/// <summary>
/// Credential مستقل لدخول الطالب إلى بوابته الدائمة.
/// لا نخزن Access Code الخام. LookupDigest يسمح بالعثور السريع على credential عالميًا،
/// بينما VerifierHash يتحقق من السر قبل إنشاء جلسة Portal.
/// </summary>
public sealed class StudentPortalCredential : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StudentId { get; set; }

    /// <summary>SHA-256 hex للكود الموحّد. فريد عالميًا.</summary>
    public string LookupDigest { get; set; } = string.Empty;

    /// <summary>ASP.NET Identity password hash للكود؛ لا يُستخدم للفهرسة.</summary>
    public string VerifierHash { get; set; } = string.Empty;

    /// <summary>آخر أربعة محارف للعرض الآمن في Studio.</summary>
    public string CodeSuffix { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Student? Student { get; set; }
    public ICollection<StudentPortalSession> Sessions { get; set; } = new List<StudentPortalSession>();
}
