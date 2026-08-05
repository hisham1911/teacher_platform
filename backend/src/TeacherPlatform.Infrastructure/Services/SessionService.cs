using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Sessions;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Use cases إدارة الجلسات من جهة المعلم: إنشاء، قائمة، تفاصيل، تفعيل، إنهاء، إلغاء.
/// كل القراءات تمر بـGlobal Filters (TenantId == CurrentTenantId) وكل الكتابات تمر بحارس
/// TenantSaveGuardInterceptor. التزامن عبر BaseVersion (xmin) — mismatch ⇒ 409 Conflict.
/// Mode=Live محجوز مستقبلاً — يُرفض حالياً بـ LiveModeNotAvailable.
/// </summary>
public sealed class SessionService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;
    private readonly IOptions<SessionOptions> _sessionOptions;

    public SessionService(
        AppDbContext db,
        ITenantContext tenantContext,
        IClock clock,
        IOptions<SessionOptions> sessionOptions)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
        _sessionOptions = sessionOptions;
    }

    /// <summary>
    /// يعيد معرف المستأجر المحلول للطلب الحالي أو يفشل بأمان.
    /// ممنوع تمرير Guid.Empty — يجب أن يكون السياق محلولًا من Middleware.
    /// </summary>
    private Guid RequireTenantId()
    {
        if (!_tenantContext.IsResolved || _tenantContext.TenantId is not Guid tenantId || tenantId == Guid.Empty)
        {
            throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved for this request.");
        }

        return tenantId;
    }

    // ---------- Create ----------

    /// <summary>
    /// ينشئ جلسة جديدة لاختبار منشور. يثبّت QuizVersionId المنشورة لحظة الإنشاء.
    /// JoinCode عشوائي Base32 فريد عالميًا (مع إعادة توليد عند التصادم).
    /// </summary>
    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> CreateAsync(
        Guid quizId,
        CreateSessionRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        if (!Enum.TryParse<SessionMode>(request.Mode, ignoreCase: true, out var mode))
        {
            return (new ServiceResultException("Validation", "Mode must be SelfPaced or Live."), null);
        }

        if (mode == SessionMode.Live)
        {
            return (new ServiceResultException("LiveModeNotAvailable", "Live mode is reserved for a future phase and is not available yet."), null);
        }

        var quiz = await _db.Quizzes
            .SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);

        if (quiz is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        if (quiz.CurrentPublishedVersionId is not Guid publishedVersionId)
        {
            return (new ServiceResultException("Conflict", "Quiz has no published version. Publish the quiz before creating a session."), null);
        }

        var now = _clock.UtcNow;
        var joinCodeLength = _sessionOptions.Value.JoinCodeLength;

        // JoinCode فريد عالميًا — نتحقق عبر IgnoreQueryFilters لأن الفهرس فريد على مستوى القاعدة كلها.
        string joinCode;
        var attempts = 0;
        do
        {
            joinCode = GuestTokenService.GenerateJoinCode(joinCodeLength);
            attempts++;
            if (attempts > 10)
            {
                return (new ServiceResultException("Conflict", "Could not allocate a unique join code. Try again."), null);
            }
        }
        while (await _db.QuizSessions.IgnoreQueryFilters().AnyAsync(s => s.JoinCode == joinCode, cancellationToken));

        var session = new QuizSession
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            QuizVersionId = publishedVersionId,
            JoinCode = joinCode,
            Mode = SessionMode.SelfPaced,
            Status = SessionStatus.Scheduled,
            Label = request.Label?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.QuizSessions.Add(session);
        await _db.SaveChangesAsync(cancellationToken);

        return (null, await BuildDetailAsync(session.Id, cancellationToken));
    }

    // ---------- List ----------

    public async Task<PagedResponse<SessionListItemResponse>> ListAsync(
        Guid quizId,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var pageNumber = Math.Max(page ?? 1, 1);
        var size = Math.Clamp(pageSize ?? 20, 1, 100);

        var baseQuery = _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.QuizId == quizId);

        var total = await baseQuery.CountAsync(cancellationToken);

        var items = await baseQuery
            .OrderByDescending(s => s.CreatedAt)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .Select(s => new SessionListItemResponse
            {
                Id = s.Id,
                QuizId = s.QuizId,
                QuizTitle = s.Quiz != null ? s.Quiz.Title : string.Empty,
                JoinCode = s.JoinCode,
                Mode = s.Mode.ToString(),
                Status = s.Status.ToString(),
                Label = s.Label,
                ParticipantCount = s.Participants.Count,
                AttemptCount = s.Attempts.Count,
                ActivatedAt = s.ActivatedAt,
                FinishedAt = s.FinishedAt,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResponse<SessionListItemResponse>
        {
            Items = items,
            Page = pageNumber,
            PageSize = size,
            TotalItems = total,
            TotalPages = (int)Math.Ceiling(total / (double)size)
        };
    }

    // ---------- Detail ----------

    public async Task<SessionDetailResponse?> GetAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        RequireTenantId();
        return await BuildDetailAsync(sessionId, cancellationToken);
    }

    // ---------- State transitions ----------

    /// <summary>Scheduled → Active. يتطلب BaseVersion مطابقًا لـxmin الحالي.</summary>
    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> ActivateAsync(
        Guid sessionId,
        SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        return await TransitionAsync(sessionId, request, SessionStatus.Scheduled, SessionStatus.Active, cancellationToken);
    }

    /// <summary>Active → Finished. يتطلب BaseVersion مطابقًا لـxmin الحالي.</summary>
    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> FinishAsync(
        Guid sessionId,
        SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        return await TransitionAsync(sessionId, request, SessionStatus.Active, SessionStatus.Finished, cancellationToken);
    }

    /// <summary>Scheduled أو Active → Cancelled. يتطلب BaseVersion مطابقًا لـxmin الحالي.</summary>
    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> CancelAsync(
        Guid sessionId,
        SessionStateChangeRequest request,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var session = await _db.QuizSessions
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null);
        }

        if (request.BaseVersion != session.Version)
        {
            return (new ServiceResultException("Conflict", "The session was modified by someone else. Reload and try again."), null);
        }

        if (session.Status is not (SessionStatus.Scheduled or SessionStatus.Active))
        {
            return (new ServiceResultException("Conflict", $"Cannot cancel a session in status {session.Status}."), null);
        }

        var now = _clock.UtcNow;
        session.Status = SessionStatus.Cancelled;
        session.FinishedAt = now;
        session.UpdatedAt = now;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The session was modified by someone else. Reload and try again."), null);
        }

        return (null, await BuildDetailAsync(sessionId, cancellationToken));
    }

    private async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> TransitionAsync(
        Guid sessionId,
        SessionStateChangeRequest request,
        SessionStatus from,
        SessionStatus to,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var session = await _db.QuizSessions
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session is null)
        {
            return (new ServiceResultException("NotFound", "Session not found."), null);
        }

        if (request.BaseVersion != session.Version)
        {
            return (new ServiceResultException("Conflict", "The session was modified by someone else. Reload and try again."), null);
        }

        if (session.Status != from)
        {
            return (new ServiceResultException("Conflict", $"Cannot transition from {session.Status} to {to}."), null);
        }

        var now = _clock.UtcNow;
        session.Status = to;
        session.UpdatedAt = now;

        if (to == SessionStatus.Active)
        {
            session.ActivatedAt = now;
        }
        else if (to is SessionStatus.Finished or SessionStatus.Cancelled)
        {
            session.FinishedAt = now;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The session was modified by someone else. Reload and try again."), null);
        }

        return (null, await BuildDetailAsync(sessionId, cancellationToken));
    }

    // ---------- Helpers ----------

    private async Task<SessionDetailResponse?> BuildDetailAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await _db.QuizSessions
            .AsNoTracking()
            .Include(s => s.Quiz)
            .Include(s => s.QuizVersion)
            .Include(s => s.Participants)
            .SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session is null)
        {
            return null;
        }

        var attempts = await _db.Attempts
            .AsNoTracking()
            .Where(a => a.SessionId == sessionId)
            .ToListAsync(cancellationToken);

        var attemptByParticipant = attempts.ToDictionary(a => a.ParticipantId);

        var participants = session.Participants
            .OrderBy(p => p.JoinedAt)
            .Select(p =>
            {
                attemptByParticipant.TryGetValue(p.Id, out var attempt);
                return new SessionParticipantResponse
                {
                    Id = p.Id,
                    DisplayName = p.DisplayName,
                    JoinedAt = p.JoinedAt,
                    AttemptId = attempt?.Id,
                    AttemptStatus = attempt?.Status.ToString(),
                    Score = attempt?.Score,
                    MaxScore = attempt?.MaxScore,
                    Percentage = attempt?.Percentage,
                    Passed = attempt?.Passed
                };
            })
            .ToList();

        return new SessionDetailResponse
        {
            Id = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.Quiz?.Title ?? string.Empty,
            QuizVersionId = session.QuizVersionId,
            QuizVersionNumber = session.QuizVersion?.VersionNumber ?? 0,
            JoinCode = session.JoinCode,
            Mode = session.Mode.ToString(),
            Status = session.Status.ToString(),
            Label = session.Label,
            ActivatedAt = session.ActivatedAt,
            FinishedAt = session.FinishedAt,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt,
            Version = session.Version,
            Participants = participants
        };
    }
}
