using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// تنفيذ حدود الاستخدام المؤقتة للاختبارات. كل الفحوص عدّ حقيقي من قاعدة البيانات
/// في السيرفر — لا يمكن للعميل تجاوزها. تُفرض قبل أي كتابة مكلفة.
/// </summary>
public sealed class QuizLimitService : IQuizLimitService
{
    private readonly AppDbContext _db;
    private readonly QuizLimitOptions _options;

    public QuizLimitService(AppDbContext db, IOptions<QuizLimitOptions> options)
    {
        _db = db;
        _options = options.Value;
    }

    public async Task<ServiceResultException?> CheckCanCreateQuizAsync(Guid tenantId, CancellationToken ct)
    {
        var count = await _db.Quizzes
            .CountAsync(q => q.Status != QuizStatus.Archived, ct);

        if (count >= _options.MaxQuizzesPerTenant)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This workspace reached the maximum number of quizzes ({_options.MaxQuizzesPerTenant}). Archive an existing quiz to free space.");
        }

        return null;
    }

    public async Task<ServiceResultException?> CheckCanAddQuestionAsync(Guid tenantId, Guid quizVersionId, CancellationToken ct)
    {
        var count = await _db.QuizVersionItems
            .CountAsync(i => i.QuizVersionId == quizVersionId, ct);

        if (count >= _options.MaxQuestionsPerQuiz)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This quiz reached the maximum number of questions ({_options.MaxQuestionsPerQuiz}).");
        }

        return null;
    }

    public async Task<ServiceResultException?> CheckCanPublishAsync(Guid tenantId, Guid quizId, CancellationToken ct)
    {
        // إن كان الاختبار منشورًا مسبقًا فإعادة النشر لا تستهلك حصة جديدة.
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .SingleOrDefaultAsync(q => q.Id == quizId, ct);

        if (quiz is null)
        {
            return new ServiceResultException("NotFound", "Quiz not found.");
        }

        if (quiz.Status == QuizStatus.Published)
        {
            return null; // إعادة نشر — لا حاجة لحصة إضافية
        }

        var publishedCount = await _db.Quizzes
            .CountAsync(q => q.Status == QuizStatus.Published, ct);

        if (publishedCount >= _options.MaxPublishedQuizzesPerTenant)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This workspace reached the maximum number of published quizzes ({_options.MaxPublishedQuizzesPerTenant}). Archive a published quiz to free space.");
        }

        return null;
    }
}
