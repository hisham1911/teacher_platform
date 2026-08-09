using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Certificates;

public sealed class Certificate : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AttemptId { get; set; }
    public Guid TemplateId { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public string PublicTokenHash { get; set; } = string.Empty;
    public string PublicTokenProtected { get; set; } = string.Empty;
    public CertificateStatus Status { get; set; } = CertificateStatus.Pending;
    public DateTime IssuedAt { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string QuizTitle { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string TitleText { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string IssuerName { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string SecondaryColor { get; set; } = string.Empty;
    public string? FileObjectKey { get; set; }
    public string? FailureReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Attempt? Attempt { get; set; }
    public CertificateTemplate? Template { get; set; }
}

public enum CertificateStatus
{
    Pending = 1,
    Ready = 2,
    Failed = 3
}
