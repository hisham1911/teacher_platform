using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Certificates;

public sealed class CertificateTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TitleText { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string IssuerName { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = "#0F766E";
    public string SecondaryColor { get; set; } = "#D97706";
    public bool IsDefault { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
}
