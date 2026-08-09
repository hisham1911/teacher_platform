using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Surveys;

public sealed class SurveyOption : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SurveyQuestionId { get; set; }
    public int SortOrder { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public SurveyQuestion? Question { get; set; }
}
