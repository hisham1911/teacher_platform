using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class ReportWorkflowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly TestWebApplicationFactory _factory;

    public ReportWorkflowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task SessionReport_UsesActualAttemptData_AndQuestionAnalytics()
    {
        var client = NewClient();
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken, "Reports");
        var seeded = await SeedReportDataAsync(tenantId);

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{seeded.SessionId}/report",
            accessToken,
            tenantId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = await ReadJsonAsync<JsonElement>(response);
        var summary = report.GetProperty("summary");

        Assert.Equal(2, summary.GetProperty("participantCount").GetInt32());
        Assert.Equal(2, summary.GetProperty("attemptCount").GetInt32());
        Assert.Equal(2, summary.GetProperty("completedCount").GetInt32());
        Assert.Equal(1, summary.GetProperty("timedOutCount").GetInt32());
        Assert.Equal(1, summary.GetProperty("passedCount").GetInt32());
        Assert.Equal(1, summary.GetProperty("failedCount").GetInt32());
        Assert.Equal(75m, summary.GetProperty("averagePercentage").GetDecimal());

        var questions = report.GetProperty("questions").EnumerateArray().ToArray();
        Assert.Equal(2, questions.Length);
        Assert.Equal(2, questions[0].GetProperty("answerCount").GetInt32());
        Assert.Equal(100m, questions[0].GetProperty("successPercentage").GetDecimal());
        Assert.Equal("LowDifficulty", questions[0].GetProperty("difficultySignal").GetString());
        Assert.Equal(50m, questions[1].GetProperty("successPercentage").GetDecimal());
        Assert.Equal("ModerateDifficulty", questions[1].GetProperty("difficultySignal").GetString());
    }

    [Fact]
    public async Task AttemptDetail_ReturnsQuestionResults()
    {
        var client = NewClient();
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken, "Attempt detail");
        var seeded = await SeedReportDataAsync(tenantId);

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/attempts/{seeded.PassedAttemptId}",
            accessToken,
            tenantId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await ReadJsonAsync<JsonElement>(response);
        Assert.Equal("طالبة ناجحة", detail.GetProperty("displayName").GetString());
        Assert.True(detail.GetProperty("passed").GetBoolean());
        Assert.Equal(2, detail.GetProperty("questions").GetArrayLength());
        Assert.All(detail.GetProperty("questions").EnumerateArray(), question =>
        {
            Assert.True(question.GetProperty("answered").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(question.GetProperty("answerSummary").GetString()));
        });
    }

    [Fact]
    public async Task AttemptDetail_CrossTenantRouteReturns404()
    {
        var client = NewClient();
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken, "Attempt tenant");
        var otherTenantId = await CreateTenantAsync(client, accessToken, "Other tenant");
        var seeded = await SeedReportDataAsync(tenantId);

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{otherTenantId}/attempts/{seeded.PassedAttemptId}",
            accessToken,
            otherTenantId));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AttemptsList_IsPaged()
    {
        var client = NewClient();
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken, "Export");
        var seeded = await SeedReportDataAsync(tenantId);

        var listResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{seeded.SessionId}/attempts?page=1&pageSize=1",
            accessToken,
            tenantId));
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var page = await ReadJsonAsync<JsonElement>(listResponse);
        Assert.Equal(1, page.GetProperty("items").GetArrayLength());
        Assert.Equal(2, page.GetProperty("totalItems").GetInt32());
        Assert.Equal(2, page.GetProperty("totalPages").GetInt32());
    }

    [Fact]
    public async Task CsvExport_NeutralizesSpreadsheetFormula()
    {
        var client = NewClient();
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken, "Export");
        var seeded = await SeedReportDataAsync(tenantId);

        var exportResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{seeded.SessionId}/report/export.csv",
            accessToken,
            tenantId));
        Assert.Equal(HttpStatusCode.OK, exportResponse.StatusCode);
        Assert.Equal("text/csv", exportResponse.Content.Headers.ContentType?.MediaType);

        var csvBytes = await exportResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, csvBytes[..3]);
        var csv = Encoding.UTF8.GetString(csvBytes);
        Assert.Contains("\"'=2+3\"", csv, StringComparison.Ordinal);
        Assert.DoesNotContain("\"=2+3\"", csv, StringComparison.Ordinal);
        Assert.Contains("Participant,Status,Score", csv, StringComparison.Ordinal);
    }

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"report-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Report Teacher"
        }));

        var confirmationUrl = _factory.EmailSender.LastActionUrlFor(
            email,
            TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmationUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new
        {
            uid = query["uid"],
            token = query["token"]
        }));

        var login = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        login.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string accessToken, string name)
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = Json(new
                {
                    name,
                    slug = $"report-{Guid.NewGuid():N}"[..24],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            },
            accessToken));
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private async Task<SeededReportData> SeedReportDataAsync(Guid tenantId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
        tenantContext.SetResolved(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var bank = new QuestionBank { Id = Guid.NewGuid(), Name = "Report bank", CreatedAt = now, UpdatedAt = now };
        var firstQuestion = CreateQuestion(bank.Id, "السؤال الأول", now);
        var secondQuestion = CreateQuestion(bank.Id, "السؤال الثاني", now);
        db.QuestionBanks.Add(bank);
        db.Questions.AddRange(firstQuestion.Question, secondQuestion.Question);
        db.QuestionVersions.AddRange(firstQuestion.Version, secondQuestion.Version);
        db.QuestionOptions.AddRange(
            firstQuestion.CorrectOption,
            firstQuestion.WrongOption,
            secondQuestion.CorrectOption,
            secondQuestion.WrongOption);

        var quizId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var quiz = new Quiz
        {
            Id = quizId,
            Title = "اختبار التقارير",
            Slug = $"report-{Guid.NewGuid():N}"[..24],
            NormalizedSlug = $"report-{Guid.NewGuid():N}"[..24],
            PublicCode = Guid.NewGuid().ToString("N"),
            Status = QuizStatus.Published,
            CurrentPublishedVersionId = versionId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var version = new QuizVersion
        {
            Id = versionId,
            QuizId = quizId,
            VersionNumber = 1,
            Status = QuizVersionStatus.Published,
            TitleSnapshot = quiz.Title,
            PassingPercentage = 60,
            PublishedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var firstItem = new QuizVersionItem
        {
            Id = Guid.NewGuid(),
            QuizVersionId = versionId,
            QuestionVersionId = firstQuestion.Version.Id,
            SortOrder = 0,
            Points = 5,
            CreatedAt = now
        };
        var secondItem = new QuizVersionItem
        {
            Id = Guid.NewGuid(),
            QuizVersionId = versionId,
            QuestionVersionId = secondQuestion.Version.Id,
            SortOrder = 1,
            Points = 5,
            CreatedAt = now
        };
        db.Quizzes.Add(quiz);
        db.QuizVersions.Add(version);
        db.QuizVersionItems.AddRange(firstItem, secondItem);

        var session = new QuizSession
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            QuizVersionId = versionId,
            JoinCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            Status = SessionStatus.Finished,
            Mode = SessionMode.SelfPaced,
            Label = "جلسة التقرير",
            ActivatedAt = now.AddMinutes(-10),
            FinishedAt = now,
            CreatedAt = now.AddMinutes(-11),
            UpdatedAt = now
        };
        var passedParticipant = CreateParticipant(session.Id, "طالبة ناجحة", now.AddMinutes(-9));
        var failedParticipant = CreateParticipant(session.Id, "=2+3", now.AddMinutes(-8));
        var passedAttempt = CreateAttempt(session.Id, passedParticipant.Id, AttemptStatus.Finished, 10m, 100m, true, now);
        var failedAttempt = CreateAttempt(session.Id, failedParticipant.Id, AttemptStatus.TimedOut, 5m, 50m, false, now);

        db.QuizSessions.Add(session);
        db.SessionParticipants.AddRange(passedParticipant, failedParticipant);
        db.Attempts.AddRange(passedAttempt, failedAttempt);
        db.AttemptAnswers.AddRange(
            CreateAnswer(passedAttempt.Id, firstItem.Id, firstQuestion.CorrectOption.Id, true, 5m, now),
            CreateAnswer(passedAttempt.Id, secondItem.Id, secondQuestion.CorrectOption.Id, true, 5m, now),
            CreateAnswer(failedAttempt.Id, firstItem.Id, firstQuestion.CorrectOption.Id, true, 5m, now),
            CreateAnswer(failedAttempt.Id, secondItem.Id, secondQuestion.WrongOption.Id, false, 0m, now));

        await db.SaveChangesAsync();
        return new SeededReportData(session.Id, passedAttempt.Id);
    }

    private static SeededQuestion CreateQuestion(Guid bankId, string prompt, DateTime now)
    {
        var questionId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var question = new Question
        {
            Id = questionId,
            BankId = bankId,
            Status = QuestionStatus.Active,
            CurrentVersionId = versionId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var version = new QuestionVersion
        {
            Id = versionId,
            QuestionId = questionId,
            VersionNumber = 1,
            QuestionType = QuestionType.MultipleChoice,
            Prompt = prompt,
            CreatedAt = now,
            UpdatedAt = now
        };
        var correct = new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionVersionId = versionId,
            SortOrder = 0,
            OptionText = "الإجابة الصحيحة",
            IsCorrect = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var wrong = new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionVersionId = versionId,
            SortOrder = 1,
            OptionText = "الإجابة الخاطئة",
            IsCorrect = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        return new SeededQuestion(question, version, correct, wrong);
    }

    private static SessionParticipant CreateParticipant(Guid sessionId, string displayName, DateTime joinedAt) => new()
    {
        Id = Guid.NewGuid(),
        SessionId = sessionId,
        DisplayName = displayName,
        GuestTokenHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Guid.NewGuid().ToByteArray())),
        GuestTokenExpiresAt = joinedAt.AddDays(30),
        JoinedAt = joinedAt,
        CreatedAt = joinedAt,
        UpdatedAt = joinedAt
    };

    private static Attempt CreateAttempt(
        Guid sessionId,
        Guid participantId,
        AttemptStatus status,
        decimal score,
        decimal percentage,
        bool passed,
        DateTime now) => new()
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            ParticipantId = participantId,
            ShuffleSeed = 1,
            Status = status,
            CurrentQuestionIndex = 2,
            StartedAt = now.AddMinutes(-5),
            FinishedAt = now,
            DurationMs = 300_000,
            Score = score,
            MaxScore = 10m,
            Percentage = percentage,
            Passed = passed,
            CreatedAt = now.AddMinutes(-5),
            UpdatedAt = now
        };

    private static AttemptAnswer CreateAnswer(
        Guid attemptId,
        Guid itemId,
        Guid optionId,
        bool isCorrect,
        decimal score,
        DateTime now) => new()
        {
            Id = Guid.NewGuid(),
            AttemptId = attemptId,
            QuizVersionItemId = itemId,
            AnswerJson = $$"""{"optionId":"{{optionId}}"}""",
            IsCorrect = isCorrect,
            ScoreAwarded = score,
            AnsweredAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

    private static HttpRequestMessage TenantRequest(
        HttpMethod method,
        string path,
        string accessToken,
        Guid tenantId)
    {
        var request = WithAccessToken(new HttpRequestMessage(method, path), accessToken);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        return request;
    }

    private static HttpRequestMessage WithAccessToken(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return request;
    }

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }

    private sealed record SeededQuestion(
        Question Question,
        QuestionVersion Version,
        QuestionOption CorrectOption,
        QuestionOption WrongOption);

    private sealed record SeededReportData(Guid SessionId, Guid PassedAttemptId);
}
