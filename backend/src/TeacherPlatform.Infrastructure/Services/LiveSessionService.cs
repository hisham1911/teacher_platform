using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// منطق المسابقة المباشرة. PostgreSQL هو مصدر الحقيقة، وSignalR يبث النتائج فقط.
/// </summary>
public sealed class LiveSessionService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly SessionOptions _options;

    public LiveSessionService(
        AppDbContext db,
        ITenantContext tenantContext,
        IClock clock,
        IOptions<SessionOptions> options)
    {
        _db = db;
        _tenantContext = (TenantContext)tenantContext;
        _clock = clock;
        _options = options.Value;
    }

    public async Task<LiveSessionStateResponse?> GetForTeacherAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        return await BuildStateAsync(tenantId, sessionId, ignoreQueryFilters: false, cancellationToken);
    }

    /// <summary>قراءة صريحة عبر حد مجهول/Hub بعد تحقق الهوية خارجيًا.</summary>
    public Task<LiveSessionStateResponse?> GetForConnectionAsync(
        Guid tenantId,
        Guid sessionId,
        CancellationToken cancellationToken) =>
        BuildStateAsync(tenantId, sessionId, ignoreQueryFilters: true, cancellationToken);

    public async Task<(ServiceResultException? Error, LiveSessionStateResponse? Result)> OpenNextAsync(
        Guid sessionId,
        LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var state = await LoadTrackedAsync(sessionId, cancellationToken);
        var error = ValidateControlState(state, request.BaseRevision);
        if (error is not null) return (error, null);

        if (state!.Phase is not (LiveSessionPhase.Lobby or LiveSessionPhase.QuestionClosed))
        {
            return (new ServiceResultException("Conflict", "Close the current question before opening the next one."), null);
        }

        var items = await _db.QuizVersionItems
            .AsNoTracking()
            .Where(item => item.QuizVersionId == state.Session!.QuizVersionId)
            .OrderBy(item => item.SortOrder)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);
        var nextIndex = state.CurrentQuestionIndex + 1;
        if (nextIndex >= items.Count)
        {
            return (new ServiceResultException("Conflict", "No more questions remain. Finish the live session."), null);
        }

        var now = _clock.UtcNow;
        var durationSeconds = request.DurationSeconds ?? _options.LiveDefaultQuestionSeconds;
        state.Phase = LiveSessionPhase.QuestionOpen;
        state.CurrentQuestionIndex = nextIndex;
        state.CurrentQuizVersionItemId = items[nextIndex];
        state.QuestionStartedAt = now;
        state.QuestionClosesAt = now.AddSeconds(durationSeconds);
        state.Revision++;
        state.UpdatedAt = now;

        var saveError = await SaveWithConcurrencyAsync(cancellationToken);
        return saveError is null
            ? (null, await BuildStateAsync(tenantId, sessionId, false, cancellationToken))
            : (saveError, null);
    }

    public async Task<(ServiceResultException? Error, LiveSessionStateResponse? Result)> CloseCurrentAsync(
        Guid sessionId,
        LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var state = await LoadTrackedAsync(sessionId, cancellationToken);
        var error = ValidateControlState(state, request.BaseRevision);
        if (error is not null) return (error, null);

        if (state!.Phase != LiveSessionPhase.QuestionOpen)
        {
            return (new ServiceResultException("Conflict", "No live question is open."), null);
        }

        state.Phase = LiveSessionPhase.QuestionClosed;
        state.QuestionClosesAt = _clock.UtcNow;
        state.Revision++;
        state.UpdatedAt = _clock.UtcNow;

        var saveError = await SaveWithConcurrencyAsync(cancellationToken);
        return saveError is null
            ? (null, await BuildStateAsync(tenantId, sessionId, false, cancellationToken))
            : (saveError, null);
    }

    public async Task<(ServiceResultException? Error, LiveSessionStateResponse? Result)> FinishAsync(
        Guid sessionId,
        LiveControlRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var state = await LoadTrackedAsync(sessionId, cancellationToken);
        var error = ValidateControlState(state, request.BaseRevision);
        if (error is not null) return (error, null);

        if (state!.Phase == LiveSessionPhase.QuestionOpen)
        {
            return (new ServiceResultException("Conflict", "Close the current question before finishing the session."), null);
        }

        var session = state.Session!;
        var items = await _db.QuizVersionItems
            .AsNoTracking()
            .Where(item => item.QuizVersionId == session.QuizVersionId)
            .ToListAsync(cancellationToken);
        var maxScore = (decimal)items.Sum(item => item.Points);
        var passingPercentage = await _db.QuizVersions
            .AsNoTracking()
            .Where(version => version.Id == session.QuizVersionId)
            .Select(version => version.PassingPercentage)
            .SingleAsync(cancellationToken);
        var attempts = await _db.Attempts
            .Include(attempt => attempt.Answers)
            .Where(attempt => attempt.SessionId == sessionId && attempt.Status == AttemptStatus.InProgress)
            .ToListAsync(cancellationToken);
        var now = _clock.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        foreach (var attempt in attempts)
        {
            var score = attempt.Answers.Sum(answer => answer.ScoreAwarded ?? 0m);
            var percentage = maxScore > 0m
                ? Math.Round(score / maxScore * 100m, 2, MidpointRounding.AwayFromZero)
                : 0m;
            attempt.Status = AttemptStatus.Finished;
            attempt.Score = score;
            attempt.MaxScore = maxScore;
            attempt.Percentage = percentage;
            attempt.Passed = percentage >= passingPercentage;
            attempt.DurationMs = Math.Max(0L, (long)(now - attempt.StartedAt).TotalMilliseconds);
            attempt.FinishedAt = now;
            attempt.UpdatedAt = now;
        }

        state.Phase = LiveSessionPhase.Finished;
        state.QuestionClosesAt ??= now;
        state.Revision++;
        state.UpdatedAt = now;
        session.Status = SessionStatus.Finished;
        session.FinishedAt = now;
        session.UpdatedAt = now;

        var saveError = await SaveWithConcurrencyAsync(cancellationToken);
        if (saveError is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return (saveError, null);
        }

        await transaction.CommitAsync(cancellationToken);
        return (null, await BuildStateAsync(tenantId, sessionId, false, cancellationToken));
    }

    /// <summary>يستدعيه العامل لإغلاق الأسئلة التي تجاوزت deadline + grace.</summary>
    public async Task<IReadOnlyList<LiveSessionStateResponse>> CloseExpiredQuestionsAsync(
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var due = await _db.LiveSessionStates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(state =>
                state.Phase == LiveSessionPhase.QuestionOpen &&
                state.QuestionClosesAt != null &&
                state.QuestionClosesAt.Value.AddSeconds(_options.GraceWindowSeconds) < now)
            .Select(state => new { state.Id, state.TenantId, state.SessionId })
            .ToListAsync(cancellationToken);
        var closed = new List<LiveSessionStateResponse>();

        foreach (var candidate in due)
        {
            _db.ChangeTracker.Clear();
            var state = await _db.LiveSessionStates
                .IgnoreQueryFilters()
                .Include(current => current.Session)
                .SingleOrDefaultAsync(
                    current => current.Id == candidate.Id && current.TenantId == candidate.TenantId,
                    cancellationToken);
            if (state is null || state.Phase != LiveSessionPhase.QuestionOpen ||
                state.QuestionClosesAt?.AddSeconds(_options.GraceWindowSeconds) >= _clock.UtcNow)
            {
                continue;
            }

            using var bootstrap = _tenantContext.BeginBootstrap(candidate.TenantId);
            state.Phase = LiveSessionPhase.QuestionClosed;
            state.Revision++;
            state.UpdatedAt = _clock.UtcNow;
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                continue;
            }

            var snapshot = await BuildStateAsync(
                candidate.TenantId,
                candidate.SessionId,
                ignoreQueryFilters: true,
                cancellationToken);
            if (snapshot is not null) closed.Add(snapshot);
        }

        return closed;
    }

    private async Task<LiveSessionState?> LoadTrackedAsync(
        Guid sessionId,
        CancellationToken cancellationToken) =>
        await _db.LiveSessionStates
            .Include(state => state.Session)
            .SingleOrDefaultAsync(state => state.SessionId == sessionId, cancellationToken);

    private static ServiceResultException? ValidateControlState(LiveSessionState? state, int baseRevision)
    {
        if (state?.Session is null || state.Session.Mode != SessionMode.Live)
        {
            return new ServiceResultException("NotFound", "Live session not found.");
        }
        if (state.Session.Status != SessionStatus.Active || state.Phase == LiveSessionPhase.Finished)
        {
            return new ServiceResultException("Conflict", "Live session is not active.");
        }
        if (state.Revision != baseRevision)
        {
            return new ServiceResultException("Conflict", "Live state changed. Reload and try again.");
        }
        return null;
    }

    private async Task<ServiceResultException?> SaveWithConcurrencyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return new ServiceResultException("Conflict", "Live state changed. Reload and try again.");
        }
    }

    private async Task<LiveSessionStateResponse?> BuildStateAsync(
        Guid tenantId,
        Guid sessionId,
        bool ignoreQueryFilters,
        CancellationToken cancellationToken)
    {
        IQueryable<LiveSessionState> stateQuery = _db.LiveSessionStates.AsNoTracking();
        IQueryable<QuizSession> sessionQuery = _db.QuizSessions.AsNoTracking();
        IQueryable<Domain.Quizzes.QuizVersionItem> itemQuery = _db.QuizVersionItems.AsNoTracking();
        IQueryable<SessionParticipant> participantQuery = _db.SessionParticipants.AsNoTracking();
        IQueryable<Attempt> attemptQuery = _db.Attempts.AsNoTracking();
        IQueryable<AttemptAnswer> answerQuery = _db.AttemptAnswers.AsNoTracking();
        if (ignoreQueryFilters)
        {
            stateQuery = stateQuery.IgnoreQueryFilters();
            sessionQuery = sessionQuery.IgnoreQueryFilters();
            itemQuery = itemQuery.IgnoreQueryFilters();
            participantQuery = participantQuery.IgnoreQueryFilters();
            attemptQuery = attemptQuery.IgnoreQueryFilters();
            answerQuery = answerQuery.IgnoreQueryFilters();
        }

        var state = await stateQuery
            .SingleOrDefaultAsync(
                current => current.TenantId == tenantId && current.SessionId == sessionId,
                cancellationToken);
        if (state is null) return null;

        var session = await sessionQuery.SingleOrDefaultAsync(
            current => current.TenantId == tenantId && current.Id == sessionId && current.Mode == SessionMode.Live,
            cancellationToken);
        if (session is null) return null;

        var items = await itemQuery
            .Where(item => item.TenantId == tenantId && item.QuizVersionId == session.QuizVersionId)
            .OrderBy(item => item.SortOrder)
            .Select(item => new
            {
                item.Id,
                item.Points,
                QuestionType = item.QuestionVersion != null ? item.QuestionVersion.QuestionType.ToString() : string.Empty,
                Prompt = item.QuestionVersion != null ? item.QuestionVersion.Prompt : string.Empty,
                MediaAssetId = item.QuestionVersion != null ? item.QuestionVersion.MediaAssetId : null,
                Options = item.QuestionVersion == null
                    ? new List<LiveQuestionOptionResponse>()
                    : item.QuestionVersion.Options
                        .OrderBy(option => option.SortOrder)
                        .Select(option => new LiveQuestionOptionResponse
                        {
                            OptionId = option.Id,
                            OptionText = option.OptionText
                        })
                        .ToList()
            })
            .ToListAsync(cancellationToken);

        var participantCount = await participantQuery.CountAsync(
            participant => participant.TenantId == tenantId && participant.SessionId == sessionId,
            cancellationToken);
        var attempts = await attemptQuery
            .Where(attempt => attempt.TenantId == tenantId && attempt.SessionId == sessionId)
            .Select(attempt => new
            {
                attempt.Id,
                DisplayName = attempt.Participant != null ? attempt.Participant.DisplayName : string.Empty
            })
            .ToListAsync(cancellationToken);
        var attemptIds = attempts.Select(attempt => attempt.Id).ToList();
        var answers = await answerQuery
            .Where(answer => answer.TenantId == tenantId && attemptIds.Contains(answer.AttemptId))
            .Select(answer => new
            {
                answer.AttemptId,
                answer.QuizVersionItemId,
                Score = answer.ScoreAwarded ?? 0m
            })
            .ToListAsync(cancellationToken);

        var currentItem = items.ElementAtOrDefault(state.CurrentQuestionIndex);
        var answeredCount = currentItem is null
            ? 0
            : answers.Count(answer => answer.QuizVersionItemId == currentItem.Id);
        var closedThroughIndex = state.Phase == LiveSessionPhase.QuestionOpen
            ? state.CurrentQuestionIndex - 1
            : state.CurrentQuestionIndex;
        var scoredItemIds = items.Take(Math.Max(0, closedThroughIndex + 1)).Select(item => item.Id).ToHashSet();
        var ranked = attempts
            .Select(attempt => new
            {
                attempt.DisplayName,
                Score = answers
                    .Where(answer => answer.AttemptId == attempt.Id && scoredItemIds.Contains(answer.QuizVersionItemId))
                    .Sum(answer => answer.Score),
                AnsweredCount = answers.Count(answer =>
                    answer.AttemptId == attempt.Id && scoredItemIds.Contains(answer.QuizVersionItemId))
            })
            .OrderByDescending(entry => entry.Score)
            .ThenByDescending(entry => entry.AnsweredCount)
            .ThenBy(entry => entry.DisplayName, StringComparer.Ordinal)
            .Select((entry, index) => new LiveLeaderboardEntryResponse
            {
                Rank = index + 1,
                DisplayName = entry.DisplayName,
                Score = entry.Score,
                AnsweredCount = entry.AnsweredCount
            })
            .ToList();

        return new LiveSessionStateResponse
        {
            InternalTenantId = tenantId,
            SessionId = session.Id,
            SessionStatus = session.Status.ToString(),
            Phase = state.Phase.ToString(),
            CurrentQuestionIndex = state.CurrentQuestionIndex,
            TotalQuestions = items.Count,
            QuestionStartedAt = state.QuestionStartedAt,
            QuestionClosesAt = state.QuestionClosesAt,
            ServerNow = _clock.UtcNow,
            Revision = state.Revision,
            ParticipantCount = participantCount,
            AttemptCount = attempts.Count,
            AnsweredCount = answeredCount,
            CurrentQuestion = currentItem is null ? null : new LiveQuestionResponse
            {
                QuizVersionItemId = currentItem.Id,
                Index = state.CurrentQuestionIndex,
                TotalQuestions = items.Count,
                QuestionType = currentItem.QuestionType,
                Prompt = currentItem.Prompt,
                Points = currentItem.Points,
                MediaAssetId = currentItem.MediaAssetId,
                Options = currentItem.Options
            },
            Leaderboard = ranked
        };
    }

    private Guid RequireTenantId()
    {
        if (!_tenantContext.IsResolved || _tenantContext.TenantId is not Guid tenantId || tenantId == Guid.Empty)
        {
            throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved.");
        }
        return tenantId;
    }
}
