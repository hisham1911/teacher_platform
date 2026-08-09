using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class ParentShareService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly TenantContext _tenantContext;
    private readonly PlayerAttemptAccessService _playerAccess;
    private readonly CertificateService _certificateService;
    private readonly IOptions<CertificateOptions> _certificateOptions;
    private readonly IOptions<AuthOptions> _authOptions;

    public ParentShareService(
        AppDbContext db,
        IClock clock,
        TenantContext tenantContext,
        PlayerAttemptAccessService playerAccess,
        CertificateService certificateService,
        IOptions<CertificateOptions> certificateOptions,
        IOptions<AuthOptions> authOptions)
    {
        _db = db;
        _clock = clock;
        _tenantContext = tenantContext;
        _playerAccess = playerAccess;
        _certificateService = certificateService;
        _certificateOptions = certificateOptions;
        _authOptions = authOptions;
    }

    public async Task<(ServiceResultException? Error, ParentShareResponse? Result)> CreateAsync(
        string joinCode,
        Guid attemptId,
        string rawGuestToken,
        CancellationToken cancellationToken)
    {
        var resolved = await _playerAccess.ResolveCompletedAsync(joinCode, attemptId, rawGuestToken, cancellationToken);
        if (resolved.Error is not null || resolved.Access is null) return (resolved.Error, null);

        var rawShareToken = GuestTokenService.GenerateRawToken();
        var now = _clock.UtcNow;
        var expiresAt = now.AddDays(_certificateOptions.Value.ParentShareDays);
        using var bootstrap = _tenantContext.BeginBootstrap(resolved.Access.Session.TenantId);
        _db.ParentResultShares.Add(new ParentResultShare
        {
            Id = Guid.NewGuid(),
            AttemptId = resolved.Access.Attempt.Id,
            TokenHash = GuestTokenService.ComputeHash(rawShareToken),
            ExpiresAt = expiresAt,
            CreatedAt = now,
            UpdatedAt = now
        });
        await _db.SaveChangesAsync(cancellationToken);

        return (null, new ParentShareResponse
        {
            ShareUrl = $"{_authOptions.Value.WebBaseUrl.TrimEnd('/')}/result/{rawShareToken}",
            ExpiresAt = expiresAt
        });
    }

    public async Task<(ServiceResultException? Error, PublicResultResponse? Result)> GetPublicAsync(
        string publicToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(publicToken))
        {
            return (new ServiceResultException("NotFound", "Shared result not found."), null);
        }

        var tokenHash = GuestTokenService.ComputeHash(publicToken);
        var share = await _db.ParentResultShares
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(current => current.TokenHash == tokenHash, cancellationToken);
        if (share is null || share.ExpiresAt <= _clock.UtcNow)
        {
            return (new ServiceResultException("NotFound", "Shared result not found or expired."), null);
        }

        var attempt = await _db.Attempts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(current => current.Participant)
            .Include(current => current.Session)!
                .ThenInclude(session => session!.Quiz)
            .SingleOrDefaultAsync(current =>
                current.Id == share.AttemptId && current.TenantId == share.TenantId,
                cancellationToken);
        if (attempt?.Participant is null || attempt.Session?.Quiz is null || attempt.FinishedAt is null)
        {
            return (new ServiceResultException("NotFound", "Shared result not found."), null);
        }

        var reviewAreas = await LoadReviewAreasAsync(attempt, cancellationToken);
        var certificate = await _db.Certificates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(current =>
                current.TenantId == share.TenantId && current.AttemptId == attempt.Id,
                cancellationToken);

        return (null, new PublicResultResponse
        {
            StudentName = attempt.Participant.DisplayName,
            QuizTitle = attempt.Session.Quiz.Title,
            Score = attempt.Score ?? 0m,
            MaxScore = attempt.MaxScore ?? 0m,
            Percentage = attempt.Percentage ?? 0m,
            Passed = attempt.Passed == true,
            FinishedAt = attempt.FinishedAt.Value,
            ReviewAreas = reviewAreas,
            CertificateUrl = _certificateService.GetPublicUrl(certificate)
        });
    }

    private async Task<IReadOnlyList<string>> LoadReviewAreasAsync(
        Domain.Sessions.Attempt attempt,
        CancellationToken cancellationToken)
    {
        var correctItemIds = await _db.AttemptAnswers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(answer =>
                answer.TenantId == attempt.TenantId &&
                answer.AttemptId == attempt.Id &&
                answer.IsCorrect == true)
            .Select(answer => answer.QuizVersionItemId)
            .ToListAsync(cancellationToken);

        return await _db.QuizVersionItems
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item =>
                item.TenantId == attempt.TenantId &&
                item.QuizVersionId == attempt.Session!.QuizVersionId &&
                !correctItemIds.Contains(item.Id))
            .OrderBy(item => item.SortOrder)
            .Select(item => item.QuestionVersion!.Prompt)
            .ToListAsync(cancellationToken);
    }
}
