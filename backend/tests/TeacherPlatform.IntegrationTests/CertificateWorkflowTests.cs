using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Domain.Operations;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class CertificateWorkflowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly TestWebApplicationFactory _factory;

    public CertificateWorkflowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task PassedAttempt_IssuesOneCertificateAndGeneratesPublicPdf()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, passed: true);
        var path = $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/certificate";

        var initial = await client.SendAsync(PlayerRequest(HttpMethod.Post, path, seeded.RawToken));

        Assert.Equal(HttpStatusCode.Accepted, initial.StatusCode);
        Assert.Equal("Pending", (await ReadJsonAsync<JsonElement>(initial)).GetProperty("status").GetString());
        await ProcessOutboxAsync();

        var repeated = await client.SendAsync(PlayerRequest(HttpMethod.Post, path, seeded.RawToken));
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        var certificate = await ReadJsonAsync<JsonElement>(repeated);
        Assert.Equal("Ready", certificate.GetProperty("status").GetString());

        var playerFile = await client.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"{path}/file",
            seeded.RawToken));
        Assert.Equal("application/pdf", playerFile.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("%PDF", Encoding.ASCII.GetString((await playerFile.Content.ReadAsByteArrayAsync())[..4]));

        var publicToken = new Uri(certificate.GetProperty("publicUrl").GetString()!).Segments[^1];
        var publicFile = await client.GetAsync($"/api/v1/player/certificates/{publicToken}");
        Assert.Equal(HttpStatusCode.OK, publicFile.StatusCode);
        Assert.Equal("application/pdf", publicFile.Content.Headers.ContentType?.MediaType);

        var teacherListResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{teacher.TenantId}/certificates",
            teacher));
        Assert.Equal(HttpStatusCode.OK, teacherListResponse.StatusCode);
        var teacherCertificate = Assert.Single(await ReadJsonAsync<JsonElement[]>(teacherListResponse));
        Assert.Equal(certificate.GetProperty("publicUrl").GetString(), teacherCertificate.GetProperty("publicUrl").GetString());
        Assert.DoesNotContain(teacherCertificate.EnumerateObject(), property =>
            property.Name is "publicTokenHash" or "publicTokenProtected" or "fileObjectKey");

        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Certificates.CountAsync(current => current.AttemptId == seeded.AttemptId));
        Assert.Equal(1, await db.OutboxMessages.CountAsync(current => current.AggregateId == certificate.GetProperty("certificateId").GetGuid()));
        await scope.ServiceProvider.GetRequiredService<CertificateGenerationService>()
            .GenerateAsync(teacher.TenantId, certificate.GetProperty("certificateId").GetGuid(), CancellationToken.None);
    }

    [Fact]
    public async Task FailedAttempt_CannotIssueCertificate()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, passed: false);

        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/certificate",
            seeded.RawToken));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("CertificateNotEligible", (await ReadJsonAsync<JsonElement>(response)).GetProperty("title").GetString());
        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<AppDbContext>().Certificates
            .CountAsync(current => current.AttemptId == seeded.AttemptId));
    }

    [Fact]
    public async Task ParentShare_ExposesOnlyOwnedResultAndReviewPrompts()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, passed: false);
        var create = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/parent-share",
            seeded.RawToken));

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var shareUrl = (await ReadJsonAsync<JsonElement>(create)).GetProperty("shareUrl").GetString()!;
        var publicToken = new Uri(shareUrl).Segments[^1];
        var publicResponse = await client.GetAsync($"/api/v1/public/results/{publicToken}");

        Assert.Equal(HttpStatusCode.OK, publicResponse.StatusCode);
        var shared = await ReadJsonAsync<JsonElement>(publicResponse);
        Assert.Equal("مريم", shared.GetProperty("studentName").GetString());
        Assert.Equal("السؤال الثاني", shared.GetProperty("reviewAreas")[0].GetString());
        Assert.False(shared.GetProperty("passed").GetBoolean());
        Assert.Equal(JsonValueKind.Null, shared.GetProperty("certificateUrl").ValueKind);
        Assert.DoesNotContain(shared.EnumerateObject(), property =>
            property.Name is "tenantId" or "attemptId" or "answerJson" or "publicTokenHash");
    }

    [Fact]
    public async Task ParentShare_ExpiredTokenReturns404()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, passed: true);
        var create = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/parent-share",
            seeded.RawToken));
        var shareUrl = (await ReadJsonAsync<JsonElement>(create)).GetProperty("shareUrl").GetString()!;
        var publicToken = new Uri(shareUrl).Segments[^1];

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var share = await db.ParentResultShares.OrderByDescending(current => current.CreatedAt).FirstAsync();
            share.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/public/results/{publicToken}")).StatusCode);
    }

    [Fact]
    public async Task OutboxFailure_IsRecordedAndScheduledForRetry()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var messageId = Guid.NewGuid();
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = messageId,
                MessageType = "UnsupportedTestMessage",
                PayloadJson = "{}",
                OccurredAt = DateTime.UtcNow,
                NextAttemptAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        await ProcessOutboxAsync();

        await using var verificationScope = _factory.Services.CreateAsyncScope();
        verificationScope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        var stored = await verificationScope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages
            .SingleAsync(current => current.Id == messageId);
        Assert.Equal(1, stored.AttemptCount);
        Assert.Equal("InvalidOperationException", stored.LastError);
        Assert.Null(stored.LockedUntil);
        Assert.Null(stored.ProcessedAt);
        Assert.True(stored.NextAttemptAt > DateTime.UtcNow);
    }

    [Fact]
    public async Task TeacherCertificateList_IsTenantScoped()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, passed: true);
        await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/certificate",
            seeded.RawToken));
        var otherTenantId = await CreateTenantAsync(client, teacher.AccessToken, "مساحة أخرى");

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{otherTenantId}/certificates",
            teacher with { TenantId = otherTenantId }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(await ReadJsonAsync<JsonElement[]>(response));
    }

    [Fact]
    public async Task CertificateTemplate_CanBeCustomizedAndRejectsStaleVersion()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var createRequest = TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{teacher.TenantId}/certificate-templates",
            teacher);
        createRequest.Content = Json(new
        {
            name = "Achievement",
            titleText = "Certificate of achievement",
            bodyText = "Awarded for passing the quiz",
            issuerName = "Knowledge Academy",
            primaryColor = "#0F766E",
            secondaryColor = "#D97706",
            isDefault = true
        });

        var create = await client.SendAsync(createRequest);

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await ReadJsonAsync<JsonElement>(create);
        var templateId = created.GetProperty("id").GetGuid();
        var version = created.GetProperty("version").GetUInt32();
        var updatePayload = new
        {
            name = "Achievement",
            titleText = "Certificate of excellence",
            bodyText = "Awarded for passing the quiz",
            issuerName = "Knowledge Academy",
            primaryColor = "#0F766E",
            secondaryColor = "#D97706",
            isDefault = true,
            baseVersion = version
        };
        var updateRequest = TenantRequest(
            HttpMethod.Put,
            $"/api/v1/tenants/{teacher.TenantId}/certificate-templates/{templateId}",
            teacher);
        updateRequest.Content = Json(updatePayload);
        var update = await client.SendAsync(updateRequest);

        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal("Certificate of excellence", (await ReadJsonAsync<JsonElement>(update)).GetProperty("titleText").GetString());

        var staleRequest = TenantRequest(
            HttpMethod.Put,
            $"/api/v1/tenants/{teacher.TenantId}/certificate-templates/{templateId}",
            teacher);
        staleRequest.Content = Json(updatePayload);
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(staleRequest)).StatusCode);
    }

    private async Task ProcessOutboxAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().ProcessBatchAsync(CancellationToken.None);
    }

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<TeacherContext> CreateTeacherAsync(HttpClient client)
    {
        var email = $"certificate-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Certificate Teacher"
        }));
        var confirmationUri = new Uri(_factory.EmailSender.LastActionUrlFor(
            email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!);
        var query = System.Web.HttpUtility.ParseQueryString(confirmationUri.Query);
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid = query["uid"], token = query["token"] }));
        var login = await client.PostAsync("/api/v1/auth/login", Json(new { email, password = "SecurePassword123!" }));
        var accessToken = (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
        return new TeacherContext(accessToken, await CreateTenantAsync(client, accessToken, "مساحة الشهادات"));
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string accessToken, string name)
    {
        var request = WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
        {
            Content = Json(new
            {
                name,
                slug = $"certificate-{Guid.NewGuid():N}"[..28],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            })
        }, accessToken);
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private async Task<SeededAttempt> SeedAttemptAsync(Guid tenantId, bool passed)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var bank = new QuestionBank { Id = Guid.NewGuid(), Name = "Certificate bank", CreatedAt = now, UpdatedAt = now };
        var firstQuestion = CreateQuestion(bank.Id, "السؤال الأول", now);
        var secondQuestion = CreateQuestion(bank.Id, "السؤال الثاني", now);
        db.QuestionBanks.Add(bank);
        db.Questions.AddRange(firstQuestion.Question, secondQuestion.Question);
        db.QuestionVersions.AddRange(firstQuestion.Version, secondQuestion.Version);
        db.QuestionOptions.AddRange(firstQuestion.Options.Concat(secondQuestion.Options));

        var quizId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var quizSlug = $"certificate-{Guid.NewGuid():N}"[..28];
        var quiz = new Quiz
        {
            Id = quizId,
            Title = "اختبار الإنجاز",
            Slug = quizSlug,
            NormalizedSlug = quizSlug,
            PublicCode = Guid.NewGuid().ToString("N"),
            Status = QuizStatus.Published,
            CurrentPublishedVersionId = versionId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var version = new QuizVersion
        {
            Id = versionId,
            QuizId = quiz.Id,
            VersionNumber = 1,
            Status = QuizVersionStatus.Published,
            TitleSnapshot = quiz.Title,
            PassingPercentage = 60,
            PublishedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var firstItem = CreateQuizItem(version.Id, firstQuestion.Version.Id, 0, now);
        var secondItem = CreateQuizItem(version.Id, secondQuestion.Version.Id, 1, now);
        var session = new QuizSession
        {
            Id = Guid.NewGuid(),
            QuizId = quiz.Id,
            QuizVersionId = version.Id,
            JoinCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            Mode = SessionMode.SelfPaced,
            Status = SessionStatus.Finished,
            ActivatedAt = now.AddMinutes(-10),
            FinishedAt = now,
            CreatedAt = now.AddMinutes(-11),
            UpdatedAt = now
        };
        var rawToken = GuestTokenService.GenerateRawToken();
        var participant = new SessionParticipant
        {
            Id = Guid.NewGuid(),
            SessionId = session.Id,
            DisplayName = "مريم",
            GuestTokenHash = GuestTokenService.ComputeHash(rawToken),
            GuestTokenExpiresAt = now.AddDays(30),
            JoinedAt = now.AddMinutes(-9),
            CreatedAt = now.AddMinutes(-9),
            UpdatedAt = now
        };
        var attempt = new Attempt
        {
            Id = Guid.NewGuid(),
            SessionId = session.Id,
            ParticipantId = participant.Id,
            ShuffleSeed = 1,
            Status = AttemptStatus.Finished,
            CurrentQuestionIndex = 2,
            StartedAt = now.AddMinutes(-8),
            FinishedAt = now,
            DurationMs = 480_000,
            Score = passed ? 10m : 5m,
            MaxScore = 10m,
            Percentage = passed ? 100m : 50m,
            Passed = passed,
            CreatedAt = now.AddMinutes(-8),
            UpdatedAt = now
        };
        db.Quizzes.Add(quiz);
        db.QuizVersions.Add(version);
        db.QuizVersionItems.AddRange(firstItem, secondItem);
        db.QuizSessions.Add(session);
        db.SessionParticipants.Add(participant);
        db.Attempts.Add(attempt);
        db.AttemptAnswers.AddRange(
            CreateAnswer(attempt.Id, firstItem.Id, true, 5m, now),
            CreateAnswer(attempt.Id, secondItem.Id, passed, passed ? 5m : 0m, now));
        await db.SaveChangesAsync();
        return new SeededAttempt(session.JoinCode, attempt.Id, rawToken);
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
            QuestionId = question.Id,
            VersionNumber = 1,
            QuestionType = QuestionType.MultipleChoice,
            Prompt = prompt,
            CreatedAt = now,
            UpdatedAt = now
        };
        var options = new[]
        {
            new QuestionOption
            {
                Id = Guid.NewGuid(), QuestionVersionId = versionId, SortOrder = 0,
                OptionText = "صحيح", IsCorrect = true, CreatedAt = now, UpdatedAt = now
            },
            new QuestionOption
            {
                Id = Guid.NewGuid(), QuestionVersionId = versionId, SortOrder = 1,
                OptionText = "خطأ", IsCorrect = false, CreatedAt = now, UpdatedAt = now
            }
        };
        return new SeededQuestion(question, version, options);
    }

    private static QuizVersionItem CreateQuizItem(Guid versionId, Guid questionVersionId, int order, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        QuizVersionId = versionId,
        QuestionVersionId = questionVersionId,
        SortOrder = order,
        Points = 5,
        CreatedAt = now
    };

    private static AttemptAnswer CreateAnswer(Guid attemptId, Guid itemId, bool correct, decimal score, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        AttemptId = attemptId,
        QuizVersionItemId = itemId,
        AnswerJson = "{}",
        IsCorrect = correct,
        ScoreAwarded = score,
        AnsweredAt = now,
        CreatedAt = now,
        UpdatedAt = now
    };

    private static HttpRequestMessage TenantRequest(
        HttpMethod method,
        string path,
        TeacherContext teacher)
    {
        var request = WithAccessToken(new HttpRequestMessage(method, path), teacher.AccessToken);
        request.Headers.Add("X-Tenant-Id", teacher.TenantId.ToString());
        return request;
    }

    private static HttpRequestMessage PlayerRequest(HttpMethod method, string path, string rawToken)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Cookie", $"tp-guest={rawToken}");
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

    private sealed record TeacherContext(string AccessToken, Guid TenantId);
    private sealed record SeededAttempt(string JoinCode, Guid AttemptId, string RawToken);
    private sealed record SeededQuestion(Question Question, QuestionVersion Version, IReadOnlyList<QuestionOption> Options);
}
