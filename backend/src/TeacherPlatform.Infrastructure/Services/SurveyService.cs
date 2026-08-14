using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Surveys;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Surveys;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class SurveyService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly ITenantContext _tenantContext;

    public SurveyService(AppDbContext db, IClock clock, ITenantContext tenantContext)
    {
        _db = db;
        _clock = clock;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<SurveyListItemResponse>> ListAsync(
        Guid? quizId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var surveys = _db.Surveys.AsNoTracking();
        if (quizId.HasValue)
        {
            surveys = surveys.Where(s => s.QuizId == quizId.Value);
        }

        return await surveys
            .OrderByDescending(s => s.UpdatedAt)
            .Select(s => new SurveyListItemResponse
            {
                Id = s.Id,
                QuizId = s.QuizId,
                QuizTitle = s.Quiz != null ? s.Quiz.Title : string.Empty,
                Title = s.Title,
                Status = s.Status.ToString(),
                QuestionCount = s.Questions.Count,
                ResponseCount = s.Responses.Count,
                PublishedAt = s.PublishedAt,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<SurveyDetailResponse?> GetAsync(Guid surveyId, CancellationToken cancellationToken)
    {
        RequireTenantId();
        var survey = await LoadSurveyAsync(surveyId, tracked: false, cancellationToken);
        return survey is null ? null : MapDetail(survey);
    }

    public async Task<SurveyResultsResponse?> GetResultsAsync(
        Guid surveyId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();
        var survey = await _db.Surveys
            .AsNoTracking()
            .AsSplitQuery()
            .Include(item => item.Questions.OrderBy(question => question.SortOrder))
                .ThenInclude(question => question.Options.OrderBy(option => option.SortOrder))
            .Include(item => item.Questions)
                .ThenInclude(question => question.Answers)
            .Include(item => item.Responses)
            .SingleOrDefaultAsync(item => item.Id == surveyId, cancellationToken);

        return survey is null ? null : MapResults(survey);
    }

    public async Task<(ServiceResultException? Error, SurveyDetailResponse? Result)> CreateAsync(
        CreateSurveyRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var definitionError = ValidateDefinition(request.Questions);
        if (definitionError is not null)
        {
            return (definitionError, null);
        }

        var quizExists = await _db.Quizzes
            .AnyAsync(q => q.Id == request.QuizId && q.Status != QuizStatus.Archived, cancellationToken);
        if (!quizExists)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        if (await _db.Surveys.AnyAsync(s => s.QuizId == request.QuizId, cancellationToken))
        {
            return (new ServiceResultException("Conflict", "A survey already exists for this quiz."), null);
        }

        var now = _clock.UtcNow;
        var survey = new Survey
        {
            Id = Guid.NewGuid(),
            QuizId = request.QuizId,
            Title = request.Title.Trim(),
            Description = NormalizeOptionalText(request.Description),
            Status = SurveyStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
            Questions = BuildQuestions(request.Questions, now)
        };

        _db.Surveys.Add(survey);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: "IX_Surveys_TenantId_QuizId"
            })
        {
            return (new ServiceResultException("Conflict", "A survey already exists for this quiz."), null);
        }

        var created = await LoadSurveyAsync(survey.Id, tracked: false, cancellationToken);
        return (null, MapDetail(created!));
    }

    public async Task<(ServiceResultException? Error, SurveyDetailResponse? Result)> UpdateAsync(
        Guid surveyId,
        UpdateSurveyRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var definitionError = ValidateDefinition(request.Questions);
        if (definitionError is not null)
        {
            return (definitionError, null);
        }

        var survey = await LoadSurveyAsync(surveyId, tracked: true, cancellationToken);
        if (survey is null)
        {
            return (new ServiceResultException("NotFound", "Survey not found."), null);
        }

        if (survey.Status != SurveyStatus.Draft)
        {
            return (new ServiceResultException("SurveyPublished", "Published surveys cannot be changed."), null);
        }

        if (survey.Version != request.BaseVersion)
        {
            return (new ServiceResultException("Conflict", "The survey was modified by someone else. Reload and try again."), null);
        }

        var now = _clock.UtcNow;
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            _db.SurveyQuestions.RemoveRange(survey.Questions);
            await _db.SaveChangesAsync(cancellationToken);

            survey.Title = request.Title.Trim();
            survey.Description = NormalizeOptionalText(request.Description);
            survey.UpdatedAt = now;
            survey.Questions = BuildQuestions(request.Questions, now);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The survey was modified by someone else. Reload and try again."), null);
        }

        var updated = await LoadSurveyAsync(survey.Id, tracked: false, cancellationToken);
        return (null, MapDetail(updated!));
    }

    public async Task<(ServiceResultException? Error, SurveyDetailResponse? Result)> PublishAsync(
        Guid surveyId,
        uint baseVersion,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var survey = await LoadSurveyAsync(surveyId, tracked: true, cancellationToken);
        if (survey is null)
        {
            return (new ServiceResultException("NotFound", "Survey not found."), null);
        }

        if (survey.Status == SurveyStatus.Published)
        {
            return (null, MapDetail(survey));
        }

        if (survey.Version != baseVersion)
        {
            return (new ServiceResultException("Conflict", "The survey was modified by someone else. Reload and try again."), null);
        }

        var definition = survey.Questions
            .OrderBy(q => q.SortOrder)
            .Select(q => new SurveyQuestionInput
            {
                QuestionType = q.QuestionType.ToString(),
                Prompt = q.Prompt,
                IsRequired = q.IsRequired,
                Options = q.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new SurveyOptionInput { OptionText = o.OptionText })
                    .ToList()
            })
            .ToList();
        var definitionError = ValidateDefinition(definition);
        if (definitionError is not null)
        {
            return (definitionError, null);
        }

        var now = _clock.UtcNow;
        survey.Status = SurveyStatus.Published;
        survey.PublishedAt = now;
        survey.UpdatedAt = now;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The survey was modified by someone else. Reload and try again."), null);
        }

        return (null, MapDetail(survey));
    }

    private async Task<Survey?> LoadSurveyAsync(
        Guid surveyId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = _db.Surveys
            .Include(s => s.Quiz)
            .Include(s => s.Questions.OrderBy(q => q.SortOrder))
                .ThenInclude(q => q.Options.OrderBy(o => o.SortOrder))
            .Include(s => s.Responses)
            .Where(s => s.Id == surveyId);

        if (!tracked)
        {
            query = query.AsNoTracking();
        }

        return await query.SingleOrDefaultAsync(cancellationToken);
    }

    private static ServiceResultException? ValidateDefinition(IReadOnlyList<SurveyQuestionInput> questions)
    {
        if (questions.Count is < 1 or > 50)
        {
            return new ServiceResultException("SurveyDefinitionInvalid", "A survey must contain between 1 and 50 questions.");
        }

        foreach (var question in questions)
        {
            if (!Enum.TryParse<SurveyQuestionType>(question.QuestionType, ignoreCase: false, out var questionType))
            {
                return new ServiceResultException("SurveyDefinitionInvalid", "Survey question type is invalid.");
            }

            if (string.IsNullOrWhiteSpace(question.Prompt))
            {
                return new ServiceResultException("SurveyDefinitionInvalid", "Survey question prompt is required.");
            }

            if (questionType == SurveyQuestionType.SingleChoice)
            {
                if (question.Options.Count is < 2 or > 20 || question.Options.Any(o => string.IsNullOrWhiteSpace(o.OptionText)))
                {
                    return new ServiceResultException(
                        "SurveyDefinitionInvalid",
                        "Single-choice questions require between 2 and 20 non-empty options.");
                }

                if (question.Options
                    .Select(o => o.OptionText.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count() != question.Options.Count)
                {
                    return new ServiceResultException("SurveyDefinitionInvalid", "Survey options must be distinct.");
                }
            }
            else if (question.Options.Count != 0)
            {
                return new ServiceResultException(
                    "SurveyDefinitionInvalid",
                    "Only single-choice questions can define options.");
            }
        }

        return null;
    }

    private static List<SurveyQuestion> BuildQuestions(
        IReadOnlyList<SurveyQuestionInput> questionInputs,
        DateTime now)
    {
        return questionInputs.Select((questionInput, questionIndex) =>
        {
            var question = new SurveyQuestion
            {
                Id = Guid.NewGuid(),
                SortOrder = questionIndex,
                QuestionType = Enum.Parse<SurveyQuestionType>(questionInput.QuestionType),
                Prompt = questionInput.Prompt.Trim(),
                IsRequired = questionInput.IsRequired,
                CreatedAt = now,
                UpdatedAt = now
            };
            question.Options = questionInput.Options.Select((optionInput, optionIndex) => new SurveyOption
            {
                Id = Guid.NewGuid(),
                SurveyQuestionId = question.Id,
                SortOrder = optionIndex,
                OptionText = optionInput.OptionText.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            }).ToList();
            return question;
        }).ToList();
    }

    private static SurveyDetailResponse MapDetail(Survey survey)
    {
        return new SurveyDetailResponse
        {
            Id = survey.Id,
            QuizId = survey.QuizId,
            QuizTitle = survey.Quiz?.Title ?? string.Empty,
            Title = survey.Title,
            Description = survey.Description,
            Status = survey.Status.ToString(),
            Version = survey.Version,
            ResponseCount = survey.Responses.Count,
            PublishedAt = survey.PublishedAt,
            CreatedAt = survey.CreatedAt,
            UpdatedAt = survey.UpdatedAt,
            Questions = survey.Questions
                .OrderBy(q => q.SortOrder)
                .Select(q => new SurveyQuestionResponse
                {
                    Id = q.Id,
                    SortOrder = q.SortOrder,
                    QuestionType = q.QuestionType.ToString(),
                    Prompt = q.Prompt,
                    IsRequired = q.IsRequired,
                    Options = q.Options
                        .OrderBy(o => o.SortOrder)
                        .Select(o => new SurveyOptionResponse
                        {
                            Id = o.Id,
                            SortOrder = o.SortOrder,
                            OptionText = o.OptionText
                        })
                        .ToList()
                })
                .ToList()
        };
    }

    private static SurveyResultsResponse MapResults(Survey survey) => new()
    {
        SurveyId = survey.Id,
        Title = survey.Title,
        ResponseCount = survey.Responses.Count,
        Questions = survey.Questions
            .OrderBy(question => question.SortOrder)
            .Select(MapQuestionResults)
            .ToList()
    };

    private static SurveyQuestionResultsResponse MapQuestionResults(SurveyQuestion question)
    {
        var ratingValues = question.Answers
            .Where(answer => answer.RatingValue.HasValue)
            .Select(answer => answer.RatingValue!.Value)
            .ToList();
        var selectedOptions = question.Answers
            .Where(answer => answer.SelectedOptionId.HasValue)
            .Select(answer => answer.SelectedOptionId!.Value)
            .ToList();
        var textResponses = question.Answers
            .Select(answer => answer.TextValue?.Trim())
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Cast<string>()
            .ToList();

        return new SurveyQuestionResultsResponse
        {
            Id = question.Id,
            SortOrder = question.SortOrder,
            QuestionType = question.QuestionType.ToString(),
            Prompt = question.Prompt,
            AnswerCount = question.QuestionType switch
            {
                SurveyQuestionType.Rating => ratingValues.Count,
                SurveyQuestionType.SingleChoice => selectedOptions.Count,
                _ => textResponses.Count
            },
            RatingAverage = ratingValues.Count == 0
                ? null
                : Math.Round(ratingValues.Average(value => (decimal)value), 2, MidpointRounding.AwayFromZero),
            RatingDistribution = BuildRatingDistribution(ratingValues),
            OptionResults = BuildOptionResults(question, selectedOptions),
            TextResponses = textResponses
        };
    }

    private static IReadOnlyList<SurveyRatingDistributionResponse> BuildRatingDistribution(
        IReadOnlyCollection<int> ratingValues) => Enumerable.Range(1, 5)
        .Select(value =>
        {
            var count = ratingValues.Count(rating => rating == value);
            return new SurveyRatingDistributionResponse
            {
                Value = value,
                Count = count,
                Percentage = Percentage(count, ratingValues.Count)
            };
        })
        .ToList();

    private static IReadOnlyList<SurveyOptionResultsResponse> BuildOptionResults(
        SurveyQuestion question,
        IReadOnlyCollection<Guid> selectedOptions) => question.Options
        .OrderBy(option => option.SortOrder)
        .Select(option =>
        {
            var count = selectedOptions.Count(optionId => optionId == option.Id);
            return new SurveyOptionResultsResponse
            {
                OptionId = option.Id,
                OptionText = option.OptionText,
                Count = count,
                Percentage = Percentage(count, selectedOptions.Count)
            };
        })
        .ToList();

    private static decimal Percentage(int count, int total) => total == 0
        ? 0m
        : Math.Round(count * 100m / total, 2, MidpointRounding.AwayFromZero);

    private Guid RequireTenantId()
    {
        if (!_tenantContext.IsResolved || _tenantContext.TenantId is not Guid tenantId || tenantId == Guid.Empty)
        {
            throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved for this request.");
        }

        return tenantId;
    }

    private static string? NormalizeOptionalText(string? text) =>
        string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}
