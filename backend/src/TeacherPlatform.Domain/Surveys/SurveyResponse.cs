using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Surveys;

public sealed class SurveyResponse : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SurveyId { get; set; }
    public Guid AttemptId { get; set; }
    public DateTime SubmittedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Survey? Survey { get; set; }
    public Attempt? Attempt { get; set; }
    public ICollection<SurveyAnswer> Answers { get; set; } = new List<SurveyAnswer>();
}
