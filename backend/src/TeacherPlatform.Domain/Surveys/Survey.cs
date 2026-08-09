using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Surveys;

public sealed class Survey : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid QuizId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public SurveyStatus Status { get; set; } = SurveyStatus.Draft;
    public DateTime? PublishedAt { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Quiz? Quiz { get; set; }
    public ICollection<SurveyQuestion> Questions { get; set; } = new List<SurveyQuestion>();
    public ICollection<SurveyResponse> Responses { get; set; } = new List<SurveyResponse>();
}

public enum SurveyStatus
{
    Draft = 1,
    Published = 2
}
