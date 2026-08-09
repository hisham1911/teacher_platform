using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Surveys;

public sealed class SurveyAnswer : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SurveyResponseId { get; set; }
    public Guid SurveyQuestionId { get; set; }
    public int? RatingValue { get; set; }
    public Guid? SelectedOptionId { get; set; }
    public string? TextValue { get; set; }
    public DateTime CreatedAt { get; set; }

    public SurveyResponse? Response { get; set; }
    public SurveyQuestion? Question { get; set; }
    public SurveyOption? SelectedOption { get; set; }
}
