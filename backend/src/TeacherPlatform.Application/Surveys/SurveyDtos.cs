using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Surveys;

public sealed class SurveyListItemResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int QuestionCount { get; set; }
    public int ResponseCount { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class SurveyDetailResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public uint Version { get; set; }
    public int ResponseCount { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public IReadOnlyList<SurveyQuestionResponse> Questions { get; set; } = [];
}

public sealed class SurveyQuestionResponse
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public IReadOnlyList<SurveyOptionResponse> Options { get; set; } = [];
}

public sealed class SurveyOptionResponse
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
    public string OptionText { get; set; } = string.Empty;
}

public sealed class CreateSurveyRequest
{
    [Required]
    public Guid QuizId { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Required, MinLength(1), MaxLength(50)]
    public IReadOnlyList<SurveyQuestionInput> Questions { get; set; } = [];
}

public sealed class UpdateSurveyRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Required, MinLength(1), MaxLength(50)]
    public IReadOnlyList<SurveyQuestionInput> Questions { get; set; } = [];

    [Required]
    public uint BaseVersion { get; set; }
}

public sealed class SurveyQuestionInput
{
    [Required, RegularExpression("Rating|SingleChoice|ShortText")]
    public string QuestionType { get; set; } = string.Empty;

    [Required, StringLength(500, MinimumLength = 1)]
    public string Prompt { get; set; } = string.Empty;

    public bool IsRequired { get; set; } = true;

    [Required, MaxLength(20)]
    public IReadOnlyList<SurveyOptionInput> Options { get; set; } = [];
}

public sealed class SurveyOptionInput
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string OptionText { get; set; } = string.Empty;
}

public sealed class PublishSurveyRequest
{
    [Required]
    public uint BaseVersion { get; set; }
}

public sealed class PlayerSurveyResponse
{
    public Guid SurveyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Submitted { get; set; }
    public IReadOnlyList<PlayerSurveyQuestionResponse> Questions { get; set; } = [];
}

public sealed class PlayerSurveyQuestionResponse
{
    public Guid QuestionId { get; set; }
    public int SortOrder { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public IReadOnlyList<PlayerSurveyOptionResponse> Options { get; set; } = [];
}

public sealed class PlayerSurveyOptionResponse
{
    public Guid OptionId { get; set; }
    public int SortOrder { get; set; }
    public string OptionText { get; set; } = string.Empty;
}

public sealed class SubmitSurveyRequest
{
    [Required, MaxLength(50)]
    public IReadOnlyList<SurveyAnswerInput> Answers { get; set; } = [];
}

public sealed class SurveyAnswerInput
{
    [Required]
    public Guid QuestionId { get; set; }

    [Range(1, 5)]
    public int? RatingValue { get; set; }

    public Guid? OptionId { get; set; }

    [StringLength(1000)]
    public string? Text { get; set; }
}

public sealed class SurveySubmissionResponse
{
    public Guid ResponseId { get; set; }
    public DateTime SubmittedAt { get; set; }
}
