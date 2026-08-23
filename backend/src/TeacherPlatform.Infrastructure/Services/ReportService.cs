using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Reports;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// تقارير الجلسات والمحاولات مشتقة مباشرة من بيانات المحاولات والإجابات الفعلية.
/// لا توجد أرقام مخزنة أو تقديرية، وكل الاستعلامات خاضعة لـTenant query filters.
/// </summary>
public sealed class ReportService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public ReportService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<SessionReportResponse?> GetSessionReportAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var session = await _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => new
            {
                s.Id,
                s.QuizId,
                s.QuizVersionId,
                QuizTitle = s.Quiz != null ? s.Quiz.Title : string.Empty,
                s.Label,
                s.Status,
                s.Mode,
                s.ActivatedAt,
                s.FinishedAt,
                ParticipantCount = s.Participants.Count
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return null;
        }

        var attempts = await _db.Attempts
            .AsNoTracking()
            .Where(a => a.SessionId == sessionId)
            .Select(a => new
            {
                a.Status,
                a.Percentage,
                a.Passed,
                a.DurationMs
            })
            .ToListAsync(cancellationToken);

        var completed = attempts
            .Where(a => a.Status is AttemptStatus.Finished or AttemptStatus.TimedOut)
            .ToList();
        var completedPercentages = completed
            .Where(a => a.Percentage.HasValue)
            .Select(a => a.Percentage!.Value)
            .ToList();
        var completedDurations = completed
            .Where(a => a.DurationMs.HasValue)
            .Select(a => a.DurationMs!.Value)
            .ToList();

        var itemRows = await _db.QuizVersionItems
            .AsNoTracking()
            .Where(i => i.QuizVersionId == session.QuizVersionId)
            .OrderBy(i => i.SortOrder)
            .Select(i => new
            {
                i.Id,
                i.QuestionVersionId,
                i.SortOrder,
                Prompt = i.QuestionVersion != null ? i.QuestionVersion.Prompt : string.Empty,
                QuestionType = i.QuestionVersion != null ? i.QuestionVersion.QuestionType : default,
                i.Points
            })
            .ToListAsync(cancellationToken);

        var answerRows = await (
            from answer in _db.AttemptAnswers.AsNoTracking()
            join attempt in _db.Attempts.AsNoTracking() on answer.AttemptId equals attempt.Id
            where attempt.SessionId == sessionId
            select new
            {
                answer.QuizVersionItemId,
                answer.IsCorrect,
                ScoreAwarded = answer.ScoreAwarded ?? 0m
            })
            .ToListAsync(cancellationToken);

        var answersByItem = answerRows
            .GroupBy(a => a.QuizVersionItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var questionAnalytics = itemRows.Select(item =>
        {
            answersByItem.TryGetValue(item.Id, out var itemAnswers);
            itemAnswers ??= [];

            var answerCount = itemAnswers.Count;
            var correctCount = itemAnswers.Count(a => a.IsCorrect == true);
            var incorrectCount = itemAnswers.Count(a => a.IsCorrect == false);
            decimal? successPercentage = answerCount == 0
                ? null
                : RoundPercentage(correctCount * 100m / answerCount);
            decimal? averageScorePercentage = answerCount == 0 || item.Points <= 0
                ? null
                : RoundPercentage(itemAnswers.Sum(a => a.ScoreAwarded) * 100m / (answerCount * item.Points));

            return new QuestionAnalyticsResponse
            {
                QuizVersionItemId = item.Id,
                QuestionVersionId = item.QuestionVersionId,
                SortOrder = item.SortOrder,
                Prompt = item.Prompt,
                QuestionType = item.QuestionType.ToString(),
                Points = item.Points,
                AnswerCount = answerCount,
                CorrectCount = correctCount,
                IncorrectCount = incorrectCount,
                SuccessPercentage = successPercentage,
                AverageScorePercentage = averageScorePercentage,
                DifficultySignal = ResolveDifficultySignal(averageScorePercentage)
            };
        }).ToList();

        return new SessionReportResponse
        {
            SessionId = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.QuizTitle,
            SessionLabel = session.Label,
            SessionStatus = session.Status.ToString(),
            SessionMode = session.Mode.ToString(),
            ActivatedAt = session.ActivatedAt,
            FinishedAt = session.FinishedAt,
            Summary = new SessionReportSummaryResponse
            {
                ParticipantCount = session.ParticipantCount,
                AttemptCount = attempts.Count,
                CompletedCount = completed.Count,
                InProgressCount = attempts.Count(a => a.Status == AttemptStatus.InProgress),
                TimedOutCount = attempts.Count(a => a.Status == AttemptStatus.TimedOut),
                PassedCount = completed.Count(a => a.Passed == true),
                FailedCount = completed.Count(a => a.Passed == false),
                AveragePercentage = completedPercentages.Count == 0
                    ? null
                    : RoundPercentage(completedPercentages.Average()),
                AverageDurationMs = completedDurations.Count == 0
                    ? null
                    : (long)Math.Round(completedDurations.Average(value => (decimal)value), MidpointRounding.AwayFromZero)
            },
            Questions = questionAnalytics
        };
    }

    public async Task<PagedResponse<AttemptListItemResponse>> ListAttemptsAsync(
        Guid sessionId,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        if (!await _db.QuizSessions.AsNoTracking().AnyAsync(s => s.Id == sessionId, cancellationToken))
        {
            throw new ServiceResultException("NotFound", "Session not found.");
        }

        var pageNumber = Math.Max(page ?? 1, 1);
        var size = Math.Clamp(pageSize ?? 20, 1, 100);
        var query = _db.Attempts.AsNoTracking().Where(a => a.SessionId == sessionId);
        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.StartedAt)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .Select(a => new AttemptListItemResponse
            {
                AttemptId = a.Id,
                ParticipantId = a.ParticipantId,
                DisplayName = a.Participant != null ? a.Participant.DisplayName : string.Empty,
                Status = a.Status.ToString(),
                Score = a.Score,
                MaxScore = a.MaxScore,
                Percentage = a.Percentage,
                Passed = a.Passed,
                Mode = a.Session != null ? a.Session.Mode.ToString() : string.Empty,
                MaxLevelReached = a.Session != null && a.Session.Mode == SessionMode.ProgressiveChallenge
                    ? a.Answers.Count
                    : null,
                DurationMs = a.DurationMs,
                StartedAt = a.StartedAt,
                FinishedAt = a.FinishedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResponse<AttemptListItemResponse>
        {
            Items = items,
            Page = pageNumber,
            PageSize = size,
            TotalItems = total,
            TotalPages = (int)Math.Ceiling(total / (double)size)
        };
    }

    public async Task<AttemptDetailResponse?> GetAttemptAsync(
        Guid attemptId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var attempt = await _db.Attempts
            .AsNoTracking()
            .Where(a => a.Id == attemptId)
            .Select(a => new
            {
                Entity = a,
                DisplayName = a.Participant != null ? a.Participant.DisplayName : string.Empty,
                QuizId = a.Session != null ? a.Session.QuizId : Guid.Empty,
                QuizVersionId = a.Session != null ? a.Session.QuizVersionId : Guid.Empty,
                QuizTitle = a.Session != null && a.Session.Quiz != null ? a.Session.Quiz.Title : string.Empty,
                SessionLabel = a.Session != null ? a.Session.Label : null,
                Mode = a.Session != null ? a.Session.Mode : default(SessionMode?)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (attempt is null)
        {
            return null;
        }

        var items = await _db.QuizVersionItems
            .AsNoTracking()
            .Where(i => i.QuizVersionId == attempt.QuizVersionId)
            .OrderBy(i => i.SortOrder)
            .Select(i => new
            {
                i.Id,
                i.QuestionVersionId,
                i.SortOrder,
                i.Points,
                Prompt = i.QuestionVersion != null ? i.QuestionVersion.Prompt : string.Empty,
                QuestionType = i.QuestionVersion != null ? i.QuestionVersion.QuestionType : default,
                Options = i.QuestionVersion!.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new ReportOption(o.Id, o.OptionText))
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        var answers = await _db.AttemptAnswers
            .AsNoTracking()
            .Where(a => a.AttemptId == attemptId)
            .ToDictionaryAsync(a => a.QuizVersionItemId, cancellationToken);

        var questionResults = items.Select(item =>
        {
            answers.TryGetValue(item.Id, out var answer);
            return new AttemptQuestionResultResponse
            {
                QuizVersionItemId = item.Id,
                QuestionVersionId = item.QuestionVersionId,
                SortOrder = item.SortOrder,
                Prompt = item.Prompt,
                QuestionType = item.QuestionType.ToString(),
                PointsPossible = item.Points,
                Answered = answer is not null,
                AnswerSummary = answer is null ? null : BuildAnswerSummary(item.QuestionType, answer.AnswerJson, item.Options),
                IsCorrect = answer?.IsCorrect,
                ScoreAwarded = answer?.ScoreAwarded,
                AnsweredAt = answer?.AnsweredAt
            };
        }).ToList();

        return new AttemptDetailResponse
        {
            AttemptId = attempt.Entity.Id,
            SessionId = attempt.Entity.SessionId,
            QuizId = attempt.QuizId,
            QuizTitle = attempt.QuizTitle,
            SessionLabel = attempt.SessionLabel,
            ParticipantId = attempt.Entity.ParticipantId,
            DisplayName = attempt.DisplayName,
            Status = attempt.Entity.Status.ToString(),
            Score = attempt.Entity.Score,
            MaxScore = attempt.Entity.MaxScore,
            Percentage = attempt.Entity.Percentage,
            Passed = attempt.Entity.Passed,
            Mode = attempt.Mode?.ToString() ?? string.Empty,
            MaxLevelReached = attempt.Mode == SessionMode.ProgressiveChallenge ? answers.Count : null,
            TotalLevels = attempt.Mode == SessionMode.ProgressiveChallenge ? items.Count : null,
            DurationMs = attempt.Entity.DurationMs,
            StartedAt = attempt.Entity.StartedAt,
            FinishedAt = attempt.Entity.FinishedAt,
            Questions = questionResults
        };
    }

    public async Task<(string FileName, byte[] Content)?> ExportSessionCsvAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();

        var session = await _db.QuizSessions
            .AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => new { s.Id, s.Mode, QuizTitle = s.Quiz != null ? s.Quiz.Title : "session" })
            .SingleOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return null;
        }

        var attempts = await _db.Attempts
            .AsNoTracking()
            .Where(a => a.SessionId == sessionId)
            .OrderBy(a => a.StartedAt)
            .Select(a => new
            {
                DisplayName = a.Participant != null ? a.Participant.DisplayName : string.Empty,
                a.Status,
                a.Score,
                a.MaxScore,
                a.Percentage,
                a.Passed,
                MaxLevelReached = session.Mode == SessionMode.ProgressiveChallenge ? a.Answers.Count : (int?)null,
                a.DurationMs,
                a.StartedAt,
                a.FinishedAt
            })
            .ToListAsync(cancellationToken);

        var csv = new StringBuilder();
        csv.AppendLine("Participant,Status,Score,MaxScore,Percentage,Passed,MaxLevelReached,DurationSeconds,StartedAtUtc,FinishedAtUtc");

        foreach (var attempt in attempts)
        {
            var values = new[]
            {
                SanitizeSpreadsheetCell(attempt.DisplayName),
                attempt.Status.ToString(),
                FormatDecimal(attempt.Score),
                FormatDecimal(attempt.MaxScore),
                FormatDecimal(attempt.Percentage),
                attempt.Passed?.ToString() ?? string.Empty,
                attempt.MaxLevelReached?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                attempt.DurationMs.HasValue
                    ? (attempt.DurationMs.Value / 1000m).ToString("0.###", CultureInfo.InvariantCulture)
                    : string.Empty,
                attempt.StartedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
                attempt.FinishedAt?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? string.Empty
            };
            csv.AppendLine(string.Join(',', values.Select(EscapeCsv)));
        }

        var safeTitle = string.Concat(session.QuizTitle
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-'))
            .Trim('-');
        if (string.IsNullOrEmpty(safeTitle))
        {
            safeTitle = "session";
        }

        var content = EncodeUtf8WithBom(csv.ToString());
        return ($"{safeTitle}-results.csv", content);
    }

    internal static string SanitizeSpreadsheetCell(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        return value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' or '\n'
            ? $"'{value}"
            : value;
    }

    private Guid RequireTenantId()
    {
        if (!_tenantContext.IsResolved || _tenantContext.TenantId is not Guid tenantId || tenantId == Guid.Empty)
        {
            throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved for this request.");
        }

        return tenantId;
    }

    private static decimal RoundPercentage(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string ResolveDifficultySignal(decimal? averageScorePercentage) => averageScorePercentage switch
    {
        null => "InsufficientData",
        >= 80m => "LowDifficulty",
        >= 50m => "ModerateDifficulty",
        _ => "HighDifficulty"
    };

    private static string FormatDecimal(decimal? value) =>
        value?.ToString("0.##", CultureInfo.InvariantCulture) ?? string.Empty;

    private static string EscapeCsv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";

    private static byte[] EncodeUtf8WithBom(string value)
    {
        var preamble = Encoding.UTF8.GetPreamble();
        var payload = Encoding.UTF8.GetBytes(value);
        var content = new byte[preamble.Length + payload.Length];
        Buffer.BlockCopy(preamble, 0, content, 0, preamble.Length);
        Buffer.BlockCopy(payload, 0, content, preamble.Length, payload.Length);
        return content;
    }

    private static string? BuildAnswerSummary(
        QuestionType questionType,
        string answerJson,
        IEnumerable<ReportOption> options)
    {
        try
        {
            using var document = JsonDocument.Parse(answerJson);
            var root = document.RootElement;
            var optionMap = options.ToDictionary(o => o.Id, o => o.OptionText);

            if (questionType is QuestionType.MultipleChoice or QuestionType.TrueFalse or QuestionType.Listening)
            {
                return root.TryGetProperty("optionId", out var optionIdElement)
                    && optionIdElement.TryGetGuid(out var optionId)
                    && optionMap.TryGetValue(optionId, out var optionText)
                        ? optionText
                        : null;
            }

            if (questionType == QuestionType.ShortAnswer)
            {
                return root.TryGetProperty("text", out var textElement) && textElement.ValueKind == JsonValueKind.String
                    ? textElement.GetString()
                    : null;
            }

            if (questionType == QuestionType.Ordering
                && root.TryGetProperty("orderedOptionIds", out var orderedIds)
                && orderedIds.ValueKind == JsonValueKind.Array)
            {
                return string.Join(" ← ", orderedIds.EnumerateArray()
                    .Select(id => id.TryGetGuid(out var optionId) && optionMap.TryGetValue(optionId, out var text)
                        ? text
                        : null)
                    .Where(text => text is not null));
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private sealed record ReportOption(Guid Id, string OptionText);
}
