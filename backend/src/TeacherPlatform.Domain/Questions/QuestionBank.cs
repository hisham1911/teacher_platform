using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Questions;

/// <summary>بنك أسئلة لتنظيم الأسئلة داخل مساحة العمل.</summary>
public sealed class QuestionBank : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<Question> Questions { get; set; } = new List<Question>();
}
