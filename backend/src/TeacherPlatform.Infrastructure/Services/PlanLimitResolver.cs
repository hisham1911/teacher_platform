using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Domain.Saas;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class PlanLimitResolver
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly QuizLimitOptions _fallback;
    private readonly TeacherPlatform.Application.Abstractions.IClock _clock;

    public PlanLimitResolver(
        AppDbContext db,
        IOptions<QuizLimitOptions> fallback,
        TeacherPlatform.Application.Abstractions.IClock clock)
    {
        _db = db;
        _fallback = fallback.Value;
        _clock = clock;
    }

    public async Task<PlanLimitsDto> GetAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var limitsJson = await _db.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(subscription =>
                subscription.TenantId == tenantId &&
                subscription.Status == SubscriptionStatus.Active &&
                subscription.StartsAt <= now &&
                (subscription.EndsAt == null || subscription.EndsAt > now) &&
                subscription.Plan != null && subscription.Plan.IsActive)
            .OrderByDescending(subscription => subscription.StartsAt)
            .Select(subscription => subscription.Plan!.LimitsJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(limitsJson))
        {
            return JsonSerializer.Deserialize<PlanLimitsDto>(limitsJson, JsonOptions)
                ?? throw new InvalidOperationException("Active plan limits are invalid.");
        }

        return new PlanLimitsDto
        {
            MaxQuizzesPerTenant = _fallback.MaxQuizzesPerTenant,
            MaxQuestionsPerQuiz = _fallback.MaxQuestionsPerQuiz,
            MaxPublishedQuizzesPerTenant = _fallback.MaxPublishedQuizzesPerTenant
        };
    }

    public static string Serialize(PlanLimitsDto limits) => JsonSerializer.Serialize(limits, JsonOptions);

    public static PlanLimitsDto Deserialize(string json) =>
        JsonSerializer.Deserialize<PlanLimitsDto>(json, JsonOptions)
        ?? throw new InvalidOperationException("Plan limits are invalid.");
}
