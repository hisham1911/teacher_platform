using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// تنفيذ حدود الاستخدام المؤقتة للاختبارات. كل الفحوص عدّ حقيقي من قاعدة البيانات
/// في السيرفر — لا يمكن للعميل تجاوزها. تُفرض قبل أي كتابة مكلفة.
///
/// GAP-D: كل فحص يستلم tenantId صريحًا ويتحقق أنه يطابق سياق المستأجر المحلول
/// (Fail-Closed عند عدم التطابق)، ويضيف شرط TenantId صريحًا فوق Global Filters
/// كدفاع متعمق — فلا يمكن أن يؤثر عدّ مستأجر في حصة مستأجر آخر.
/// </summary>
public sealed class QuizLimitService : IQuizLimitService
{
    private readonly AppDbContext _db;
    private readonly PlanLimitResolver _limits;
    private readonly ITenantContext _tenantContext;

    public QuizLimitService(AppDbContext db, PlanLimitResolver limits, ITenantContext tenantContext)
    {
        _db = db;
        _limits = limits;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// يتحقق أن tenantId الممرر حقيقي ويطابق السياق المحلول. أي اختلاف ⇒ فشل مغلق.
    /// </summary>
    private void RequireMatchingTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty
            || !_tenantContext.IsResolved
            || _tenantContext.TenantId is not Guid resolved
            || resolved != tenantId)
        {
            throw new ServiceResultException(
                "TenantContextMismatch",
                "Tenant limit check rejected: tenant id does not match the resolved tenant context.");
        }
    }

    public async Task<ServiceResultException?> CheckCanCreateQuizAsync(Guid tenantId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        var limits = await _limits.GetAsync(tenantId, ct);

        var count = await _db.Quizzes
            .CountAsync(q => q.TenantId == tenantId && q.Status != QuizStatus.Archived, ct);

        if (count >= limits.MaxQuizzesPerTenant)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This workspace reached the maximum number of quizzes ({limits.MaxQuizzesPerTenant}). Archive an existing quiz to free space.");
        }

        return null;
    }

    public async Task<ServiceResultException?> CheckCanAddQuestionAsync(Guid tenantId, Guid quizVersionId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        var limits = await _limits.GetAsync(tenantId, ct);

        var count = await _db.QuizVersionItems
            .CountAsync(i => i.QuizVersionId == quizVersionId, ct);

        if (count >= limits.MaxQuestionsPerQuiz)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This quiz reached the maximum number of questions ({limits.MaxQuestionsPerQuiz}).");
        }

        return null;
    }

    public async Task<ServiceResultException?> CheckCanPublishAsync(Guid tenantId, Guid quizId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        var limits = await _limits.GetAsync(tenantId, ct);

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
            .CountAsync(q => q.TenantId == tenantId && q.Status == QuizStatus.Published, ct);

        if (publishedCount >= limits.MaxPublishedQuizzesPerTenant)
        {
            return new ServiceResultException(
                "QuotaExceeded",
                $"This workspace reached the maximum number of published quizzes ({limits.MaxPublishedQuizzesPerTenant}). Archive a published quiz to free space.");
        }

        return null;
    }
}
