using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Surveys;

public sealed class SurveyQuestion : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SurveyId { get; set; }
    public int SortOrder { get; set; }
    public SurveyQuestionType QuestionType { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public bool IsRequired { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Survey? Survey { get; set; }
    public ICollection<SurveyOption> Options { get; set; } = new List<SurveyOption>();
    public ICollection<SurveyAnswer> Answers { get; set; } = new List<SurveyAnswer>();
}

public enum SurveyQuestionType
{
    Rating = 1,
    SingleChoice = 2,
    ShortText = 3
}
