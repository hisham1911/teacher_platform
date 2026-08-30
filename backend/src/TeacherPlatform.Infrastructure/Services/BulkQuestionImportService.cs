using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Quizzes;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Persists a reviewed question import as one database transaction.
/// Individual services remain the source of truth for question validation, tags, quiz limits,
/// draft pinning, and tenant guards; this service only orchestrates them atomically.
/// </summary>
public sealed class BulkQuestionImportService
{
    private const int MaximumQuestionsPerImport = 200;

    private readonly AppDbContext _db;
    private readonly QuestionService _questionService;
    private readonly QuizService _quizService;

    public BulkQuestionImportService(
        AppDbContext db,
        QuestionService questionService,
        QuizService quizService)
    {
        _db = db;
        _questionService = questionService;
        _quizService = quizService;
    }

    public async Task<BulkQuestionImportResponse> ImportAsync(
        BulkQuestionImportRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        if (request.Questions.Count is < 1 or > MaximumQuestionsPerImport)
        {
            throw new ServiceResultException(
                "QuestionInvalid",
                $"An import must contain between 1 and {MaximumQuestionsPerImport} questions.");
        }

        // Fail before opening the write transaction if the target activity is missing.
        if (request.QuizId is Guid quizId)
        {
            var (draftError, _) = await _quizService.GetDraftAsync(quizId, cancellationToken);
            if (draftError is not null)
            {
                throw draftError;
            }
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var createdIds = new List<Guid>(request.Questions.Count);

        try
        {
            for (var index = 0; index < request.Questions.Count; index += 1)
            {
                var (questionError, created) = await _questionService.CreateQuestionAsync(
                    request.Questions[index],
                    currentUserId,
                    cancellationToken);

                if (questionError is not null)
                {
                    throw WithRowContext(questionError, index);
                }

                createdIds.Add(created!.Id);

                if (request.QuizId is Guid targetQuizId)
                {
                    var (attachError, _) = await _quizService.AddItemAsync(
                        targetQuizId,
                        new AddQuizItemRequest { QuestionId = created.Id },
                        cancellationToken);

                    if (attachError is not null)
                    {
                        throw WithRowContext(attachError, index);
                    }
                }
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            // The scoped DbContext should never expose rolled-back Added/Modified entities to
            // later code in the same request (for example exception middleware diagnostics).
            _db.ChangeTracker.Clear();
            throw;
        }

        return new BulkQuestionImportResponse
        {
            CreatedCount = createdIds.Count,
            QuestionIds = createdIds,
            QuizId = request.QuizId
        };
    }

    private static ServiceResultException WithRowContext(ServiceResultException error, int zeroBasedIndex) =>
        new(error.ErrorCode, $"Import row {zeroBasedIndex + 1}: {error.Message}");
}
