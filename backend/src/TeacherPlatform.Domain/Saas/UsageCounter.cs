using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Saas;

public sealed class UsageCounter : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string Metric { get; set; } = string.Empty;
    public long Value { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public static class UsageMetrics
{
    public const string PublishedQuizzes = "PublishedQuizzes";
    public const string Attempts = "Attempts";
    public const string StorageBytes = "StorageBytes";
    public const string CertificatesIssued = "CertificatesIssued";
}
