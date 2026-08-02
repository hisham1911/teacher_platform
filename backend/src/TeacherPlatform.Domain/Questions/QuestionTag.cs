using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Questions;

/// <summary>وسم للبحث والتنظيم. فريد داخل المستأجر بعد التطبيع (lower + trim).</summary>
public sealed class QuestionTag : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>التفرد عليه: Name بأحرف صغيرة.</summary>
    public string NormalizedName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<QuestionTagLink> QuestionLinks { get; set; } = new List<QuestionTagLink>();
}

/// <summary>ربط سؤال بوسم — Composite PK يمنع التكرار، وكلاهما Tenant-owned بنفس المستأجر.</summary>
public sealed class QuestionTagLink : ITenantEntity
{
    public Guid QuestionId { get; set; }

    public Guid TagId { get; set; }

    public Guid TenantId { get; set; }

    public Question? Question { get; set; }

    public QuestionTag? Tag { get; set; }
}
