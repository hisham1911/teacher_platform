using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Media;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Surveys;

namespace TeacherPlatform.Application.Saas;

public sealed class TenantExportManifest
{
    public int FormatVersion { get; set; } = 1;
    public DateTime ExportedAt { get; set; }
    public Guid TenantId { get; set; }
    public string AppVersion { get; set; } = string.Empty;
    public Dictionary<string, int> Counts { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, string> Checksums { get; set; } = new(StringComparer.Ordinal);
}

public sealed class TenantTransferSummary
{
    public bool DryRun { get; set; }
    public Guid SourceTenantId { get; set; }
    public Guid TargetTenantId { get; set; }
    public IReadOnlyDictionary<string, int> Counts { get; set; } = new Dictionary<string, int>();
}

public sealed class TenantQuestionsExport
{
    public List<ExportQuestionBank> Banks { get; set; } = [];
    public List<ExportMediaAsset> Media { get; set; } = [];
    public List<ExportQuestion> Questions { get; set; } = [];
    public List<ExportQuestionVersion> Versions { get; set; } = [];
    public List<ExportQuestionOption> Options { get; set; } = [];
    public List<ExportQuestionTag> Tags { get; set; } = [];
    public List<ExportQuestionTagLink> TagLinks { get; set; } = [];
}

public sealed record ExportQuestionBank(Guid Id, string Name, string? Description);
public sealed record ExportMediaAsset(
    Guid Id,
    string ArchivePath,
    string MimeType,
    long SizeBytes,
    MediaKind Kind,
    string OriginalFileName);
public sealed record ExportQuestion(Guid Id, Guid BankId, QuestionStatus Status, Guid? CurrentVersionId);
public sealed record ExportQuestionVersion(
    Guid Id,
    Guid QuestionId,
    int VersionNumber,
    QuestionType QuestionType,
    string Prompt,
    string? Explanation,
    QuestionDifficulty Difficulty,
    string Language,
    string ConfigJson,
    Guid? MediaAssetId);
public sealed record ExportQuestionOption(
    Guid Id,
    Guid QuestionVersionId,
    int SortOrder,
    string OptionText,
    bool IsCorrect);
public sealed record ExportQuestionTag(Guid Id, string Name, string NormalizedName);
public sealed record ExportQuestionTagLink(Guid QuestionId, Guid TagId);

public sealed class TenantQuizzesExport
{
    public List<ExportQuiz> Quizzes { get; set; } = [];
    public List<ExportQuizVersion> Versions { get; set; } = [];
    public List<ExportQuizVersionItem> Items { get; set; } = [];
}

public sealed record ExportQuiz(
    Guid Id,
    string Title,
    string Slug,
    string? Description,
    QuizStatus Status,
    Guid? CurrentDraftVersionId,
    Guid? CurrentPublishedVersionId,
    Guid? SubjectId,
    Guid? GradeId);
public sealed record ExportQuizVersion(
    Guid Id,
    Guid QuizId,
    int VersionNumber,
    QuizVersionStatus Status,
    string TitleSnapshot,
    string? DescriptionSnapshot,
    string? InstructionsSnapshot,
    int PassingPercentage,
    QuizTimeMode TimeMode,
    int? TimeLimitSeconds,
    bool ShuffleQuestions,
    bool ShuffleOptions,
    string ThemeJson,
    DateTime? PublishedAt);
public sealed record ExportQuizVersionItem(
    Guid Id,
    Guid QuizVersionId,
    Guid QuestionVersionId,
    int SortOrder,
    int Points,
    bool IsRequired);

public sealed class TenantSurveysExport
{
    public List<ExportSurvey> Surveys { get; set; } = [];
    public List<ExportSurveyQuestion> Questions { get; set; } = [];
    public List<ExportSurveyOption> Options { get; set; } = [];
}

public sealed record ExportSurvey(
    Guid Id,
    Guid QuizId,
    string Title,
    string? Description,
    SurveyStatus Status,
    DateTime? PublishedAt);
public sealed record ExportSurveyQuestion(
    Guid Id,
    Guid SurveyId,
    int SortOrder,
    SurveyQuestionType QuestionType,
    string Prompt,
    bool IsRequired);
public sealed record ExportSurveyOption(
    Guid Id,
    Guid SurveyQuestionId,
    int SortOrder,
    string OptionText);

public sealed record ExportCertificateTemplate(
    Guid Id,
    string Name,
    string TitleText,
    string BodyText,
    string IssuerName,
    string PrimaryColor,
    string SecondaryColor,
    bool IsDefault);
