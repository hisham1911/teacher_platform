using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Media;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// منطق واجهة الطالب (Player): الانضمام عبر Join Code، بدء المحاولة،
/// جلب السؤال الحالي، تسجيل الإجابات، الإنهاء، وعرض النتيجة.
///
/// قرارات أمنية/معمارية موثقة في ADR-007:
/// - كل الاستعلامات تستخدم IgnoreQueryFilters مع تحديد TenantId صراحةً لأن
///   مسارات /api/v1/player لا تحمل tenantId في المسار ولا يوجد JWT.
/// - كل الكتابات تُغلَّف بـ TenantContext.BeginBootstrap(session.TenantId)
///   حتى يمر TenantSaveGuardInterceptor ويختم TenantId من السياق.
/// - رمز الضيف الخام لا يُخزَّن ولا يُسجَّل — يُعاد مرة واحدة من JoinAsync
///   ليضعه الكنترولر في كوكي HttpOnly.
/// - لا يوجد Background Worker: التسوية عند الطلب (Settle-on-request).
/// </summary>
public sealed class PlayerService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly IOptions<SessionOptions> _sessionOptions;
    private readonly GuestTokenService _guestTokens;
    private readonly TenantContext _tenantContext;
    private readonly IObjectStorage _storage;

    public PlayerService(
        AppDbContext db,
        IClock clock,
        IOptions<SessionOptions> sessionOptions,
        GuestTokenService guestTokens,
        ITenantContext tenantContext,
        IObjectStorage storage)
    {
        _db = db;
        _clock = clock;
        _sessionOptions = sessionOptions;
        _guestTokens = guestTokens;
        _tenantContext = (TenantContext)tenantContext;
        _storage = storage;
    }

    /// <summary>عرض معلومات الجلسة للطالب قبل الانضمام (بدون أي محتوى أسئلة).</summary>
    public async Task<(ServiceResultException? Error, PlayerSessionResponse? Result)> GetByJoinCodeAsync(
        string joinCode,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionByJoinCodeAsync(joinCode, cancellationToken);
        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null);
        }

        var version = await LoadVersionWithItemsAsync(session, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        return (null, new PlayerSessionResponse
        {
            Title = version.TitleSnapshot,
            Description = version.DescriptionSnapshot,
            Instructions = version.InstructionsSnapshot,
            PassingPercentage = version.PassingPercentage,
            TimeMode = version.TimeMode.ToString(),
            TimeLimitSeconds = version.TimeLimitSeconds,
            QuestionCount = version.Items.Count,
            TotalPoints = version.Items.Sum(i => i.Points),
            Status = session.Status.ToString(),
            CanJoin = session.Status == SessionStatus.Active
        });
    }

    /// <summary>
    /// انضمام طالب. Idempotent: نفس رمز الضيف الصالح يعيد نفس المشارك.
    /// يعيد الرمز الخام مرة واحدة فقط ليخزنه الكنترولر في كوكي HttpOnly.
    /// </summary>
    public async Task<(ServiceResultException? Error, JoinSessionResponse? Result, string? RawToken)> JoinAsync(
        string joinCode,
        JoinSessionRequest request,
        string? existingRawToken,
        CancellationToken cancellationToken)
    {
        var session = await LoadSessionByJoinCodeAsync(joinCode, cancellationToken);
        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null, null);
        }

        if (session.Status != SessionStatus.Active)
        {
            return (new ServiceResultException("SessionNotActive", "Session is not accepting participants."), null, null);
        }

        var now = _clock.UtcNow;

        // إعادة انضمام idempotent بنفس رمز الضيف
        if (!string.IsNullOrEmpty(existingRawToken))
        {
            var existing = await ResolveParticipantAsync(session, existingRawToken, cancellationToken);
            if (existing is not null)
            {
                var existingAttempt = await _db.Attempts
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        a => a.SessionId == session.Id && a.ParticipantId == existing.Id && a.TenantId == session.TenantId,
                        cancellationToken);

                return (null, new JoinSessionResponse
                {
                    ParticipantId = existing.Id,
                    DisplayName = existing.DisplayName,
                    AttemptId = existingAttempt?.Id,
                    AttemptStatus = existingAttempt?.Status.ToString()
                }, null);
            }
        }

        var participantCount = await _db.SessionParticipants
            .IgnoreQueryFilters()
            .CountAsync(p => p.SessionId == session.Id && p.TenantId == session.TenantId, cancellationToken);
        if (participantCount >= _sessionOptions.Value.MaxParticipantsPerSession)
        {
            return (new ServiceResultException("QuotaExceeded", "Session participant limit reached."), null, null);
        }

        var rawToken = GuestTokenService.GenerateRawToken();
        var participant = new SessionParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = session.TenantId,
            SessionId = session.Id,
            DisplayName = request.DisplayName.Trim(),
            GuestTokenHash = GuestTokenService.ComputeHash(rawToken),
            GuestTokenExpiresAt = _guestTokens.ComputeExpiry(_sessionOptions.Value.GuestTokenDays),
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        using (var bootstrap = _tenantContext.BeginBootstrap(session.TenantId))
        {
            _db.SessionParticipants.Add(participant);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return (null, new JoinSessionResponse
        {
            ParticipantId = participant.Id,
            DisplayName = participant.DisplayName,
            AttemptId = null,
            AttemptStatus = null
        }, rawToken);
    }

    /// <summary>بدء محاولة. Idempotent: المحاولة الموجودة تُعاد كما هي (استئناف بعد F5).</summary>
    public async Task<(ServiceResultException? Error, StartAttemptResponse? Result)> StartAttemptAsync(
        string joinCode,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        if (session!.Status != SessionStatus.Active)
        {
            return (new ServiceResultException("SessionNotActive", "Session is not active."), null);
        }

        var version = await LoadVersionWithItemsAsync(session, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        var now = _clock.UtcNow;

        var existing = await _db.Attempts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                a => a.SessionId == session.Id && a.ParticipantId == participant!.Id && a.TenantId == session.TenantId,
                cancellationToken);
        if (existing is not null)
        {
            return (null, BuildStartAttemptResponse(existing, version));
        }

        var attempt = new Attempt
        {
            Id = Guid.NewGuid(),
            TenantId = session.TenantId,
            SessionId = session.Id,
            ParticipantId = participant!.Id,
            ShuffleSeed = RandomNumberGenerator.GetInt32(int.MaxValue),
            Revision = 0,
            Status = AttemptStatus.InProgress,
            CurrentQuestionIndex = 0,
            StartedAt = now,
            DeadlineAt = version.TimeMode == QuizTimeMode.TotalTime && version.TimeLimitSeconds.HasValue
                ? now.AddSeconds(version.TimeLimitSeconds.Value)
                : null,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            using var bootstrap = _tenantContext.BeginBootstrap(session.TenantId);
            _db.Attempts.Add(attempt);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // سباق على القيد الفريد (SessionId, ParticipantId) — أعد المحاولة الموجودة
            _db.ChangeTracker.Clear();
            var raced = await _db.Attempts
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    a => a.SessionId == session.Id && a.ParticipantId == participant.Id && a.TenantId == session.TenantId,
                    cancellationToken);
            if (raced is not null)
            {
                return (null, BuildStartAttemptResponse(raced, version));
            }

            throw;
        }

        return (null, BuildStartAttemptResponse(attempt, version));
    }

    /// <summary>السؤال الحالي بصيغة آمنة (بدون IsCorrect ولا الإجابات المقبولة).</summary>
    public async Task<(ServiceResultException? Error, PlayerQuestionResponse? Result)> GetCurrentQuestionAsync(
        string joinCode,
        Guid attemptId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        var attempt = await LoadAttemptAsync(session!, participant!, attemptId, tracked: true, cancellationToken);
        if (attempt is null)
        {
            return (new ServiceResultException("NotFound", "Attempt not found."), null);
        }

        var version = await LoadVersionWithItemsAsync(session!, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        var now = _clock.UtcNow;

        // تسوية عند الطلب: انتهاء الوقت الكلي
        if (attempt.Status == AttemptStatus.InProgress && IsPastDeadline(attempt.DeadlineAt, now))
        {
            await FinalizeAttemptAsync(session!, attempt, version, now, timedOut: true, cancellationToken);
            return (new ServiceResultException("AttemptFinished", "Attempt time has expired."), null);
        }

        if (attempt.Status != AttemptStatus.InProgress)
        {
            return (new ServiceResultException("AttemptFinished", "Attempt is already finished."), null);
        }

        var orderedItems = OrderItems(version, attempt.ShuffleSeed);
        if (orderedItems.Count == 0)
        {
            return (new ServiceResultException("NotFound", "Quiz version has no questions."), null);
        }

        // تسوية Per-Question: إن تجاوز الطالب نافذة السؤال الحالي + السماح نُنهي المحاولة TimedOut
        if (version.TimeMode == QuizTimeMode.PerQuestion && version.TimeLimitSeconds.HasValue)
        {
            var questionDeadline = attempt.StartedAt.AddSeconds((attempt.CurrentQuestionIndex + 1) * (double)version.TimeLimitSeconds.Value);
            if (IsPastDeadline(questionDeadline, now))
            {
                await FinalizeAttemptAsync(session!, attempt, version, now, timedOut: true, cancellationToken);
                return (new ServiceResultException("AttemptFinished", "Attempt time has expired."), null);
            }
        }

        var index = Math.Clamp(attempt.CurrentQuestionIndex, 0, orderedItems.Count - 1);
        var item = orderedItems[index];
        var questionVersion = item.QuestionVersion;
        if (questionVersion is null)
        {
            return (new ServiceResultException("NotFound", "Question content not found."), null);
        }

        var options = SeededShuffler.MaybeShuffle(
            questionVersion.Options.OrderBy(o => o.SortOrder).ToList(),
            attempt.ShuffleSeed,
            version.ShuffleOptions);

        var alreadyAnswered = await _db.AttemptAnswers
            .IgnoreQueryFilters()
            .AnyAsync(
                a => a.AttemptId == attempt.Id && a.QuizVersionItemId == item.Id && a.TenantId == session!.TenantId,
                cancellationToken);

        DateTime? deadlineAt = version.TimeMode switch
        {
            QuizTimeMode.TotalTime => attempt.DeadlineAt,
            QuizTimeMode.PerQuestion when version.TimeLimitSeconds.HasValue =>
                attempt.StartedAt.AddSeconds((index + 1) * (double)version.TimeLimitSeconds.Value),
            _ => null
        };

        return (null, new PlayerQuestionResponse
        {
            QuizVersionItemId = item.Id,
            Index = index,
            TotalQuestions = orderedItems.Count,
            QuestionType = questionVersion.QuestionType.ToString(),
            Prompt = questionVersion.Prompt,
            Points = item.Points,
            IsRequired = item.IsRequired,
            MediaAssetId = questionVersion.MediaAssetId,
            Options = options.Select(o => new PlayerQuestionOptionResponse
            {
                OptionId = o.Id,
                OptionText = o.OptionText
            }).ToList(),
            AlreadyAnswered = alreadyAnswered,
            DeadlineAt = deadlineAt,
            ServerNow = now
        });
    }

    /// <summary>
    /// تسجيل إجابة مع تصحيح فوري على الخادم.
    /// Idempotent: نفس الإجابة تُعاد؛ إجابة مختلفة لنفس السؤال → AnswerConflict (409).
    /// </summary>
    public async Task<(ServiceResultException? Error, SubmitAnswerResponse? Result)> SubmitAnswerAsync(
        string joinCode,
        Guid attemptId,
        SubmitAnswerRequest request,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        var attempt = await LoadAttemptAsync(session!, participant!, attemptId, tracked: true, cancellationToken);
        if (attempt is null)
        {
            return (new ServiceResultException("NotFound", "Attempt not found."), null);
        }

        var version = await LoadVersionWithItemsAsync(session!, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        var now = _clock.UtcNow;

        if (attempt.Status == AttemptStatus.InProgress && IsPastDeadline(attempt.DeadlineAt, now))
        {
            await FinalizeAttemptAsync(session!, attempt, version, now, timedOut: true, cancellationToken);
            return (new ServiceResultException("AttemptFinished", "Attempt time has expired."), null);
        }

        if (attempt.Status != AttemptStatus.InProgress)
        {
            return (new ServiceResultException("AttemptFinished", "Attempt is already finished."), null);
        }

        var item = version.Items.FirstOrDefault(i => i.Id == request.QuizVersionItemId);
        if (item?.QuestionVersion is null)
        {
            return (new ServiceResultException("NotFound", "Question not found in this session."), null);
        }

        // Idempotency: إجابة موجودة لنفس السؤال
        var existingAnswer = await _db.AttemptAnswers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                a => a.AttemptId == attempt.Id && a.QuizVersionItemId == item.Id && a.TenantId == session!.TenantId,
                cancellationToken);
        if (existingAnswer is not null)
        {
            // jsonb يعيد تنسيق JSON المخزَّن (مسافات/ترتيب مفاتيح) — المقارنة دلالية وليست نصية.
            if (AnswerJsonEquals(existingAnswer.AnswerJson, request.AnswerJson))
            {
                return (null, new SubmitAnswerResponse
                {
                    AttemptId = attempt.Id,
                    QuizVersionItemId = item.Id,
                    IsCorrect = existingAnswer.IsCorrect ?? false,
                    ScoreAwarded = existingAnswer.ScoreAwarded ?? 0m,
                    Revision = attempt.Revision,
                    ServerNow = now
                });
            }

            return (new ServiceResultException("AnswerConflict", "A different answer was already submitted for this question."), null);
        }

        var questionVersion = item.QuestionVersion;
        var scoring = AnswerScorer.Score(
            questionVersion.QuestionType,
            questionVersion.ConfigJson,
            questionVersion.Options.OrderBy(o => o.SortOrder).ToList(),
            request.AnswerJson,
            item.Points);

        var answer = new AttemptAnswer
        {
            Id = Guid.NewGuid(),
            TenantId = session!.TenantId,
            AttemptId = attempt.Id,
            QuizVersionItemId = item.Id,
            AnswerJson = request.AnswerJson,
            IsCorrect = scoring.IsCorrect,
            ScoreAwarded = scoring.ScoreAwarded,
            AnsweredAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        var orderedItems = OrderItems(version, attempt.ShuffleSeed);
        var answeredIndex = orderedItems.FindIndex(i => i.Id == item.Id);

        try
        {
            using var bootstrap = _tenantContext.BeginBootstrap(session.TenantId);
            _db.AttemptAnswers.Add(answer);
            attempt.Revision++;
            if (answeredIndex >= 0 && answeredIndex == attempt.CurrentQuestionIndex)
            {
                attempt.CurrentQuestionIndex++;
            }

            attempt.UpdatedAt = now;
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // سباق على القيد الفريد (AttemptId, QuizVersionItemId)
            _db.ChangeTracker.Clear();
            var raced = await _db.AttemptAnswers
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    a => a.AttemptId == attempt.Id && a.QuizVersionItemId == item.Id && a.TenantId == session.TenantId,
                    cancellationToken);
            if (raced is not null && AnswerJsonEquals(raced.AnswerJson, request.AnswerJson))
            {
                return (null, new SubmitAnswerResponse
                {
                    AttemptId = attempt.Id,
                    QuizVersionItemId = item.Id,
                    IsCorrect = raced.IsCorrect ?? false,
                    ScoreAwarded = raced.ScoreAwarded ?? 0m,
                    Revision = attempt.Revision,
                    ServerNow = _clock.UtcNow
                });
            }

            return (new ServiceResultException("AnswerConflict", "A different answer was already submitted for this question."), null);
        }

        return (null, new SubmitAnswerResponse
        {
            AttemptId = attempt.Id,
            QuizVersionItemId = item.Id,
            IsCorrect = scoring.IsCorrect,
            ScoreAwarded = scoring.ScoreAwarded,
            Revision = attempt.Revision,
            ServerNow = now
        });
    }

    /// <summary>إنهاء المحاولة. Idempotent: المحاولة المنتهية تُعيد نتيجتها الحالية.</summary>
    public async Task<(ServiceResultException? Error, FinishAttemptResponse? Result)> FinishAsync(
        string joinCode,
        Guid attemptId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        var attempt = await LoadAttemptAsync(session!, participant!, attemptId, tracked: true, cancellationToken);
        if (attempt is null)
        {
            return (new ServiceResultException("NotFound", "Attempt not found."), null);
        }

        var version = await LoadVersionWithItemsAsync(session!, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        var now = _clock.UtcNow;

        if (attempt.Status != AttemptStatus.InProgress)
        {
            return (null, BuildFinishResponse(attempt));
        }

        var timedOut = IsPastDeadline(attempt.DeadlineAt, now);
        await FinalizeAttemptAsync(session!, attempt, version, now, timedOut, cancellationToken);
        return (null, BuildFinishResponse(attempt));
    }

    /// <summary>نتيجة المحاولة للطالب صاحب الرمز فقط.</summary>
    public async Task<(ServiceResultException? Error, AttemptResultResponse? Result)> GetResultAsync(
        string joinCode,
        Guid attemptId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        var attempt = await LoadAttemptAsync(session!, participant!, attemptId, tracked: false, cancellationToken);
        if (attempt is null)
        {
            return (new ServiceResultException("NotFound", "Attempt not found."), null);
        }

        var version = await LoadVersionWithItemsAsync(session!, cancellationToken);
        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Session quiz version not found."), null);
        }

        return (null, new AttemptResultResponse
        {
            AttemptId = attempt.Id,
            Status = attempt.Status.ToString(),
            DisplayName = participant!.DisplayName,
            Score = attempt.Score,
            MaxScore = attempt.MaxScore,
            Percentage = attempt.Percentage,
            Passed = attempt.Passed,
            DurationMs = attempt.DurationMs,
            AnsweredCount = attempt.Answers.Count,
            TotalQuestions = version.Items.Count,
            StartedAt = attempt.StartedAt,
            FinishedAt = attempt.FinishedAt
        });
    }

    /// <summary>
    /// بث وسيط سؤال للطالب صاحب رمز الضيف. خاص: يتطلب رمزًا صالحًا، ويتحقق أن الوسيط
    /// مرتبط فعلًا بسؤال ضمن نسخة الاختبار المثبتة للجلسة — لا يعمل كـoracle لوسائط المستأجر.
    /// </summary>
    public async Task<(ServiceResultException? Error, (MediaAsset Asset, Stream Content)? Result)> OpenQuestionMediaAsync(
        string joinCode,
        Guid attemptId,
        Guid mediaId,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var (error, session, participant) = await ResolveSessionAndParticipantAsync(joinCode, rawToken, cancellationToken);
        if (error is not null)
        {
            return (error, null);
        }

        // المحاولة يجب أن تخص صاحب الرمز — تمنع استعراض وسائط محاولات الآخرين.
        var attemptExists = await _db.Attempts
            .IgnoreQueryFilters()
            .AnyAsync(
                a => a.Id == attemptId &&
                     a.SessionId == session!.Id &&
                     a.ParticipantId == participant!.Id &&
                     a.TenantId == session.TenantId,
                cancellationToken);
        if (!attemptExists)
        {
            return (new ServiceResultException("NotFound", "Attempt not found."), null);
        }

        // الوسيط يجب أن يكون مرتبطًا بسؤال ضمن النسخة المثبتة لهذه الجلسة.
        var isReferenced = await _db.QuizVersionItems
            .IgnoreQueryFilters()
            .AnyAsync(
                i => i.QuizVersionId == session!.QuizVersionId &&
                     i.TenantId == session.TenantId &&
                     i.QuestionVersion != null &&
                     i.QuestionVersion.MediaAssetId == mediaId,
                cancellationToken);
        if (!isReferenced)
        {
            return (new ServiceResultException("NotFound", "Media not found."), null);
        }

        var asset = await _db.MediaAssets
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(a => a.Id == mediaId && a.TenantId == session!.TenantId, cancellationToken);
        if (asset is null)
        {
            return (new ServiceResultException("NotFound", "Media not found."), null);
        }

        Stream content;
        try
        {
            content = await _storage.OpenReadAsync(asset.ObjectKey, cancellationToken);
        }
        catch (FileNotFoundException)
        {
            return (new ServiceResultException("NotFound", "Media content is missing from storage."), null);
        }

        return (null, (asset, content));
    }

    // ---------- Helpers ----------

    private async Task<QuizSession?> LoadSessionByJoinCodeAsync(string joinCode, CancellationToken cancellationToken)
    {
        return await _db.QuizSessions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(s => s.JoinCode == joinCode, cancellationToken);
    }

    private async Task<(ServiceResultException? Error, QuizSession? Session, SessionParticipant? Participant)>
        ResolveSessionAndParticipantAsync(string joinCode, string rawToken, CancellationToken cancellationToken)
    {
        var session = await LoadSessionByJoinCodeAsync(joinCode, cancellationToken);
        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null, null);
        }

        if (string.IsNullOrEmpty(rawToken))
        {
            return (new ServiceResultException("Unauthorized", "Guest token is required."), null, null);
        }

        var participant = await ResolveParticipantAsync(session, rawToken, cancellationToken);
        if (participant is null)
        {
            return (new ServiceResultException("Unauthorized", "Guest token is invalid or expired."), null, null);
        }

        return (null, session, participant);
    }

    /// <summary>
    /// يحل المشارك من رمز الضيف: بحث بالهاش + تحقق بمقارنة ثابتة الزمن + صلاحية زمنية.
    /// </summary>
    private async Task<SessionParticipant?> ResolveParticipantAsync(
        QuizSession session,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var hash = GuestTokenService.ComputeHash(rawToken);
        var participant = await _db.SessionParticipants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.SessionId == session.Id && p.TenantId == session.TenantId && p.GuestTokenHash == hash,
                cancellationToken);

        if (participant is null)
        {
            return null;
        }

        // دفاع إضافي بمقارنة ثابتة الزمن
        if (!GuestTokenService.Verify(rawToken, participant.GuestTokenHash))
        {
            return null;
        }

        if (participant.GuestTokenExpiresAt <= _clock.UtcNow)
        {
            return null;
        }

        return participant;
    }

    private async Task<QuizVersion?> LoadVersionWithItemsAsync(QuizSession session, CancellationToken cancellationToken)
    {
        return await _db.QuizVersions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(v => v.Items)
                .ThenInclude(i => i.QuestionVersion!)
                    .ThenInclude(q => q.Options)
            .SingleOrDefaultAsync(v => v.Id == session.QuizVersionId && v.TenantId == session.TenantId, cancellationToken);
    }

    private async Task<Attempt?> LoadAttemptAsync(
        QuizSession session,
        SessionParticipant participant,
        Guid attemptId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = _db.Attempts
            .IgnoreQueryFilters()
            .Include(a => a.Answers)
            .Where(a =>
                a.Id == attemptId &&
                a.SessionId == session.Id &&
                a.ParticipantId == participant.Id &&
                a.TenantId == session.TenantId);

        if (!tracked)
        {
            query = query.AsNoTracking();
        }

        return await query.SingleOrDefaultAsync(cancellationToken);
    }

    private static List<QuizVersionItem> OrderItems(QuizVersion version, int shuffleSeed)
    {
        var ordered = version.Items.OrderBy(i => i.SortOrder).ToList();
        return SeededShuffler.MaybeShuffle(ordered, shuffleSeed, version.ShuffleQuestions).ToList();
    }

    /// <summary>
    /// مقارنة دلالية لحمولتي إجابة JSON. العمود jsonb يعيد تنسيق النص المخزَّن
    /// (مسافات، ترتيب مفاتيح، تطبيع أرقام) لذا المقارنة النصية Ordinal غير صالحة
    /// لتحقق Idempotency. عند تعذر التحليل نسقط إلى مقارنة نصية.
    /// </summary>
    private static bool AnswerJsonEquals(string stored, string incoming)
    {
        if (string.Equals(stored, incoming, StringComparison.Ordinal))
        {
            return true;
        }

        try
        {
            using var storedDoc = JsonDocument.Parse(stored);
            using var incomingDoc = JsonDocument.Parse(incoming);
            return JsonElementDeepEquals(storedDoc.RootElement, incomingDoc.RootElement);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool JsonElementDeepEquals(JsonElement left, JsonElement right)
    {
        if (left.ValueKind != right.ValueKind)
        {
            // jsonb قد يطبّع الأرقام (1 مقابل 1.0) — قارن القيمة الرقمية عند اختلاف النوع رقميًا.
            if (left.ValueKind is JsonValueKind.Number && right.ValueKind is JsonValueKind.Number)
            {
                return left.GetDecimal() == right.GetDecimal();
            }

            return false;
        }

        switch (left.ValueKind)
        {
            case JsonValueKind.Object:
                var leftProps = left.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).ToList();
                var rightProps = right.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).ToList();
                if (leftProps.Count != rightProps.Count)
                {
                    return false;
                }

                for (var i = 0; i < leftProps.Count; i++)
                {
                    if (!string.Equals(leftProps[i].Name, rightProps[i].Name, StringComparison.Ordinal) ||
                        !JsonElementDeepEquals(leftProps[i].Value, rightProps[i].Value))
                    {
                        return false;
                    }
                }

                return true;

            case JsonValueKind.Array:
                if (left.GetArrayLength() != right.GetArrayLength())
                {
                    return false;
                }

                var index = 0;
                foreach (var item in left.EnumerateArray())
                {
                    if (!JsonElementDeepEquals(item, right[index++]))
                    {
                        return false;
                    }
                }

                return true;

            case JsonValueKind.Number:
                return left.GetDecimal() == right.GetDecimal();

            default:
                return left.GetRawText() == right.GetRawText();
        }
    }

    private bool IsPastDeadline(DateTime? deadlineAt, DateTime now)
    {
        return deadlineAt.HasValue &&
               now > deadlineAt.Value.AddSeconds(_sessionOptions.Value.GraceWindowSeconds);
    }

    /// <summary>
    /// إنهاء المحاولة وتجميع الدرجات على الخادم. التقريب: AwayFromZero لمنزلتين.
    /// </summary>
    private async Task FinalizeAttemptAsync(
        QuizSession session,
        Attempt attempt,
        QuizVersion version,
        DateTime now,
        bool timedOut,
        CancellationToken cancellationToken)
    {
        var score = attempt.Answers.Sum(a => a.ScoreAwarded ?? 0m);
        var maxScore = (decimal)version.Items.Sum(i => i.Points);
        var percentage = maxScore > 0m
            ? Math.Round(score / maxScore * 100m, 2, MidpointRounding.AwayFromZero)
            : 0m;

        using var bootstrap = _tenantContext.BeginBootstrap(session.TenantId);
        attempt.Status = timedOut ? AttemptStatus.TimedOut : AttemptStatus.Finished;
        attempt.Score = score;
        attempt.MaxScore = maxScore;
        attempt.Percentage = percentage;
        attempt.Passed = percentage >= version.PassingPercentage;
        attempt.DurationMs = (long)(now - attempt.StartedAt).TotalMilliseconds;
        attempt.FinishedAt = now;
        attempt.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private StartAttemptResponse BuildStartAttemptResponse(Attempt attempt, QuizVersion version)
    {
        return new StartAttemptResponse
        {
            AttemptId = attempt.Id,
            StartedAt = attempt.StartedAt,
            DeadlineAt = attempt.DeadlineAt,
            ServerNow = _clock.UtcNow,
            TotalQuestions = version.Items.Count,
            CurrentQuestionIndex = attempt.CurrentQuestionIndex,
            Status = attempt.Status.ToString()
        };
    }

    private static FinishAttemptResponse BuildFinishResponse(Attempt attempt)
    {
        return new FinishAttemptResponse
        {
            AttemptId = attempt.Id,
            Status = attempt.Status.ToString(),
            Score = attempt.Score ?? 0m,
            MaxScore = attempt.MaxScore ?? 0m,
            Percentage = attempt.Percentage ?? 0m,
            Passed = attempt.Passed ?? false,
            DurationMs = attempt.DurationMs ?? 0L,
            FinishedAt = attempt.FinishedAt
        };
    }
}
