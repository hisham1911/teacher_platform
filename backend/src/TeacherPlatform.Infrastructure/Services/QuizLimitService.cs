using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class QuizLimitService : IQuizLimitService
{
    private readonly AppDbContext _db;
    private readonly PlanLimitResolver _limits;
    private readonly ITenantContext _tenantContext;
    private readonly CommercialPolicyService _commercial;

    public QuizLimitService(
        AppDbContext db,
        PlanLimitResolver limits,
        ITenantContext tenantContext,
        CommercialPolicyService commercial)
    {
        _db = db;
        _limits = limits;
        _tenantContext = tenantContext;
        _commercial = commercial;
    }

    private void RequireMatchingTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty || !_tenantContext.IsResolved || _tenantContext.TenantId is not Guid resolved || resolved != tenantId)
            throw new ServiceResultException("TenantContextMismatch", "Tenant limit check rejected: tenant id does not match the resolved tenant context.");
    }

    public async Task<ServiceResultException?> CheckCanCreateQuizAsync(Guid tenantId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        await _commercial.RequireWorkspaceMutationAsync(tenantId, ct);
        var limits = await _limits.GetAsync(tenantId, ct);
        var count = await _db.Quizzes.CountAsync(q => q.TenantId == tenantId && q.Status != QuizStatus.Archived, ct);
        return count >= limits.MaxQuizzesPerTenant
            ? new ServiceResultException("QuotaExceeded", $"This workspace reached the maximum number of activities ({limits.MaxQuizzesPerTenant}). Archive an existing activity or upgrade the plan.")
            : null;
    }

    public async Task<ServiceResultException?> CheckCanAddQuestionAsync(Guid tenantId, Guid quizVersionId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        await _commercial.RequireWorkspaceMutationAsync(tenantId, ct);
        var limits = await _limits.GetAsync(tenantId, ct);
        var count = await _db.QuizVersionItems.CountAsync(i => i.QuizVersionId == quizVersionId, ct);
        return count >= limits.MaxQuestionsPerQuiz
            ? new ServiceResultException("QuotaExceeded", $"This activity reached the maximum number of questions ({limits.MaxQuestionsPerQuiz}).")
            : null;
    }

    public async Task<ServiceResultException?> CheckCanPublishAsync(Guid tenantId, Guid quizId, CancellationToken ct)
    {
        RequireMatchingTenant(tenantId);
        await _commercial.RequireWorkspaceMutationAsync(tenantId, ct);
        var limits = await _limits.GetAsync(tenantId, ct);
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, ct);
        if (quiz is null) return new ServiceResultException("NotFound", "Activity not found.");
        if (quiz.Status == QuizStatus.Published) return null;
        var publishedCount = await _db.Quizzes.CountAsync(q => q.TenantId == tenantId && q.Status == QuizStatus.Published, ct);
        return publishedCount >= limits.MaxPublishedQuizzesPerTenant
            ? new ServiceResultException("QuotaExceeded", $"This workspace reached the maximum number of published activities ({limits.MaxPublishedQuizzesPerTenant}). Archive one or upgrade the plan.")
            : null;
    }
}
