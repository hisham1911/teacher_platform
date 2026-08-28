using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Quizzes;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Durable use case behind the teacher's «Prepare student link» button.
/// Publish, session creation and activation either commit together or roll back together.
/// RequestId makes network retries return the same session instead of creating duplicates.
/// </summary>
public sealed class ActivityLaunchService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly QuizService _quizService;
    private readonly SessionService _sessionService;

    public ActivityLaunchService(
        AppDbContext db,
        ITenantContext tenantContext,
        QuizService quizService,
        SessionService sessionService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _quizService = quizService;
        _sessionService = sessionService;
    }

    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> LaunchAsync(
        Guid quizId,
        ActivityLaunchRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        if (request.RequestId == Guid.Empty)
        {
            return (new ServiceResultException("Validation", "RequestId must be a non-empty UUID."), null);
        }

        if (!Enum.TryParse<SessionMode>(request.Mode, ignoreCase: true, out var mode))
        {
            return (new ServiceResultException("Validation", "Mode must be SelfPaced, Live or ProgressiveChallenge."), null);
        }

        var existing = await FindExistingAsync(request.RequestId, cancellationToken);
        if (existing is not null)
        {
            return ValidateExisting(existing, quizId, mode);
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var (draftError, draft) = await _quizService.GetDraftAsync(quizId, cancellationToken);
            if (draftError is not null || draft is null)
            {
                return (draftError ?? new ServiceResultException("NotFound", "Quiz draft not found."), null);
            }

            if (draft.Version != request.DraftBaseVersion)
            {
                return (new ServiceResultException("Conflict", "The activity changed. Reload it before preparing a student link."), null);
            }

            if (!string.Equals(draft.PublicationState, "PublishedCurrent", StringComparison.Ordinal))
            {
                var (publishError, _) = await _quizService.PublishAsync(
                    quizId,
                    new PublishQuizRequest { BaseVersion = request.DraftBaseVersion },
                    cancellationToken);
                if (publishError is not null)
                {
                    return (publishError, null);
                }
            }

            var (createError, created) = await _sessionService.CreateAsync(
                quizId,
                new CreateSessionRequest { Mode = request.Mode, Label = request.Label ?? draft.Title },
                cancellationToken,
                request.RequestId);
            if (createError is not null || created is null)
            {
                return (createError ?? new ServiceResultException("Conflict", "Could not create the activity session."), null);
            }

            SessionDetailResponse result = created;
            if (mode != SessionMode.Live)
            {
                var (activationError, activated) = await _sessionService.ActivateAsync(
                    created.Id,
                    new SessionStateChangeRequest { BaseVersion = created.Version },
                    cancellationToken);
                if (activationError is not null || activated is null)
                {
                    return (activationError ?? new ServiceResultException("Conflict", "Could not activate the activity session."), null);
                }

                result = activated;
            }

            await transaction.CommitAsync(cancellationToken);
            return (null, result);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            _db.ChangeTracker.Clear();
            var winner = await FindExistingAsync(request.RequestId, cancellationToken);
            return winner is null
                ? (new ServiceResultException("Conflict", "The launch request conflicted with another request. Try again."), null)
                : ValidateExisting(winner, quizId, mode);
        }
    }

    private async Task<SessionDetailResponse?> FindExistingAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var sessionId = await _db.QuizSessions
            .AsNoTracking()
            .Where(session => session.LaunchRequestId == requestId)
            .Select(session => (Guid?)session.Id)
            .SingleOrDefaultAsync(cancellationToken);

        return sessionId is Guid id ? await _sessionService.GetAsync(id, cancellationToken) : null;
    }

    private static (ServiceResultException? Error, SessionDetailResponse? Result) ValidateExisting(
        SessionDetailResponse existing,
        Guid quizId,
        SessionMode mode)
    {
        if (existing.QuizId != quizId || !string.Equals(existing.Mode, mode.ToString(), StringComparison.Ordinal))
        {
            return (new ServiceResultException("Conflict", "RequestId was already used for a different activity launch."), null);
        }

        return (null, existing);
    }

    private Guid RequireTenantId() =>
        _tenantContext.IsResolved && _tenantContext.TenantId is Guid tenantId && tenantId != Guid.Empty
            ? tenantId
            : throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved for this request.");

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
