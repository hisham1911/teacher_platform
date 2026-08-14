using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class SurveyWorkflowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly TestWebApplicationFactory _factory;

    public SurveyWorkflowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task TeacherSurvey_PublishesSixQuestionDefinition()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);

        var published = await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);

        Assert.Equal("Published", published.GetProperty("status").GetString());
        Assert.Equal(6, published.GetProperty("questions").GetArrayLength());
        Assert.Equal(
            new[] { "Rating", "SingleChoice", "ShortText", "Rating", "SingleChoice", "ShortText" },
            published.GetProperty("questions").EnumerateArray()
                .Select(question => question.GetProperty("questionType").GetString())
                .ToArray());
    }

    [Fact]
    public async Task TeacherSurvey_PublishedDefinitionCannotBeChanged()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        var published = await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);
        var surveyId = published.GetProperty("id").GetGuid();

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Put,
            $"/api/v1/tenants/{teacher.TenantId}/surveys/{surveyId}",
            teacher,
            new
            {
                title = "تعديل غير مسموح",
                description = "بعد النشر",
                questions = SurveyQuestions(),
                baseVersion = published.GetProperty("version").GetUInt32()
            }));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("SurveyPublished", (await ReadJsonAsync<JsonElement>(response)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task PlayerSurvey_CompletedAttemptSubmitsAllQuestionTypes()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);

        var playerSurvey = await GetPlayerSurveyAsync(client, seeded);
        var answers = BuildValidAnswers(playerSurvey);
        var submitResponse = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey",
            seeded.RawToken,
            new { answers }));

        Assert.Equal(HttpStatusCode.Created, submitResponse.StatusCode);
        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.SurveyResponses.Include(response => response.Answers).SingleAsync();
        Assert.Equal(6, stored.Answers.Count);
        Assert.Contains(stored.Answers, answer => answer.RatingValue == 5);
        Assert.Contains(stored.Answers, answer => answer.SelectedOptionId.HasValue);
        Assert.Contains(stored.Answers, answer => answer.TextValue == "تجربة واضحة ومفيدة");

        var restored = await GetPlayerSurveyAsync(client, seeded);
        Assert.True(restored.GetProperty("submitted").GetBoolean());
    }

    [Fact]
    public async Task TeacherSurveyResults_AggregateRatingChoiceAndTextAnswers()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        var published = await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);
        var answers = BuildValidAnswers(await GetPlayerSurveyAsync(client, seeded));
        var submitResponse = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey",
            seeded.RawToken,
            new { answers }));
        submitResponse.EnsureSuccessStatusCode();

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{teacher.TenantId}/surveys/{published.GetProperty("id").GetGuid()}/results",
            teacher));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = await ReadJsonAsync<JsonElement>(response);
        Assert.Equal(1, results.GetProperty("responseCount").GetInt32());

        var questions = results.GetProperty("questions").EnumerateArray().ToList();
        var rating = questions.First(question => question.GetProperty("questionType").GetString() == "Rating");
        Assert.Equal(5m, rating.GetProperty("ratingAverage").GetDecimal());
        var fiveStars = rating.GetProperty("ratingDistribution").EnumerateArray()
            .Single(entry => entry.GetProperty("value").GetInt32() == 5);
        Assert.Equal(1, fiveStars.GetProperty("count").GetInt32());
        Assert.Equal(100m, fiveStars.GetProperty("percentage").GetDecimal());

        var choice = questions.First(question => question.GetProperty("questionType").GetString() == "SingleChoice");
        var selected = choice.GetProperty("optionResults").EnumerateArray()
            .Single(entry => entry.GetProperty("count").GetInt32() == 1);
        Assert.Equal(100m, selected.GetProperty("percentage").GetDecimal());

        var text = questions.First(question => question.GetProperty("questionType").GetString() == "ShortText");
        Assert.Contains("تجربة واضحة ومفيدة", text.GetProperty("textResponses").EnumerateArray()
            .Select(entry => entry.GetString()));
    }

    [Fact]
    public async Task TeacherSurveyResults_WithoutResponsesReturnZeroSafeAggregates()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        var published = await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{teacher.TenantId}/surveys/{published.GetProperty("id").GetGuid()}/results",
            teacher));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = await ReadJsonAsync<JsonElement>(response);
        Assert.Equal(0, results.GetProperty("responseCount").GetInt32());

        var questions = results.GetProperty("questions").EnumerateArray().ToList();
        var rating = questions.First(question => question.GetProperty("questionType").GetString() == "Rating");
        Assert.Equal(JsonValueKind.Null, rating.GetProperty("ratingAverage").ValueKind);
        Assert.All(rating.GetProperty("ratingDistribution").EnumerateArray(), entry =>
            Assert.Equal(0m, entry.GetProperty("percentage").GetDecimal()));
        var choice = questions.First(question => question.GetProperty("questionType").GetString() == "SingleChoice");
        Assert.All(choice.GetProperty("optionResults").EnumerateArray(), entry =>
            Assert.Equal(0m, entry.GetProperty("percentage").GetDecimal()));
    }

    [Fact]
    public async Task PlayerSurvey_DuplicateSubmissionReturns409AndKeepsOneResponse()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);
        var answers = BuildValidAnswers(await GetPlayerSurveyAsync(client, seeded));
        var path = $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey";

        var first = await client.SendAsync(PlayerRequest(HttpMethod.Post, path, seeded.RawToken, new { answers }));
        var duplicate = await client.SendAsync(PlayerRequest(HttpMethod.Post, path, seeded.RawToken, new { answers }));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("SurveyAlreadySubmitted", (await ReadJsonAsync<JsonElement>(duplicate)).GetProperty("title").GetString());

        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.SurveyResponses.CountAsync());
    }

    [Theory]
    [InlineData("missing-required")]
    [InlineData("rating-out-of-range")]
    [InlineData("foreign-option")]
    public async Task PlayerSurvey_InvalidAnswersReturn400WithoutPersistence(string invalidCase)
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);
        var playerSurvey = await GetPlayerSurveyAsync(client, seeded);
        var answers = BuildValidAnswers(playerSurvey);

        if (invalidCase == "missing-required")
        {
            answers.RemoveAt(0);
        }
        else if (invalidCase == "rating-out-of-range")
        {
            answers.First(answer => answer.RatingValue.HasValue).RatingValue = 6;
        }
        else
        {
            answers.First(answer => answer.OptionId.HasValue).OptionId = Guid.NewGuid();
        }

        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey",
            seeded.RawToken,
            new { answers }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var scope = _factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetResolved(teacher.TenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await db.SurveyResponses.CountAsync());
    }

    [Fact]
    public async Task PlayerSurvey_InProgressAttemptReturns409()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.InProgress);
        await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);

        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey",
            seeded.RawToken));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("AttemptNotCompleted", (await ReadJsonAsync<JsonElement>(response)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task TeacherSurvey_CrossTenantRouteReturns404()
    {
        var client = NewClient();
        var teacher = await CreateTeacherAsync(client);
        var seeded = await SeedAttemptAsync(teacher.TenantId, AttemptStatus.Finished);
        var published = await CreateAndPublishSurveyAsync(client, teacher, seeded.QuizId);
        var otherTenantId = await CreateTenantAsync(client, teacher.AccessToken, "Other surveys");
        var otherContext = teacher with { TenantId = otherTenantId };

        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{otherTenantId}/surveys/{published.GetProperty("id").GetGuid()}",
            otherContext));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var resultsResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{otherTenantId}/surveys/{published.GetProperty("id").GetGuid()}/results",
            otherContext));
        Assert.Equal(HttpStatusCode.NotFound, resultsResponse.StatusCode);
    }

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<TeacherContext> CreateTeacherAsync(HttpClient client)
    {
        var email = $"survey-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Survey Teacher"
        }));

        var confirmationUrl = _factory.EmailSender.LastActionUrlFor(
            email,
            TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var confirmationUri = new Uri(confirmationUrl);
        var query = System.Web.HttpUtility.ParseQueryString(confirmationUri.Query);
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid = query["uid"], token = query["token"] }));

        var login = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        login.EnsureSuccessStatusCode();
        var accessToken = (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
        var tenantId = await CreateTenantAsync(client, accessToken, "Survey workspace");
        return new TeacherContext(accessToken, tenantId);
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string accessToken, string name)
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = Json(new
                {
                    name,
                    slug = $"survey-{Guid.NewGuid():N}"[..24],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            },
            accessToken));
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private async Task<SeededAttempt> SeedAttemptAsync(Guid tenantId, AttemptStatus attemptStatus)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
        tenantContext.SetResolved(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var quizId = Guid.NewGuid();
        var quizVersionId = Guid.NewGuid();
        var quiz = new Quiz
        {
            Id = quizId,
            Title = "اختبار الاستبانة",
            Slug = $"survey-{Guid.NewGuid():N}"[..24],
            NormalizedSlug = $"survey-{Guid.NewGuid():N}"[..24],
            PublicCode = Guid.NewGuid().ToString("N"),
            Status = QuizStatus.Published,
            CurrentPublishedVersionId = quizVersionId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var quizVersion = new QuizVersion
        {
            Id = quizVersionId,
            QuizId = quizId,
            VersionNumber = 1,
            Status = QuizVersionStatus.Published,
            TitleSnapshot = quiz.Title,
            PublishedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var session = new QuizSession
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            QuizVersionId = quizVersionId,
            JoinCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            Mode = SessionMode.SelfPaced,
            Status = SessionStatus.Active,
            ActivatedAt = now.AddMinutes(-10),
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
            Status = attemptStatus,
            StartedAt = now.AddMinutes(-8),
            FinishedAt = attemptStatus == AttemptStatus.InProgress ? null : now,
            DurationMs = attemptStatus == AttemptStatus.InProgress ? null : 480_000,
            Score = attemptStatus == AttemptStatus.InProgress ? null : 8m,
            MaxScore = attemptStatus == AttemptStatus.InProgress ? null : 10m,
            Percentage = attemptStatus == AttemptStatus.InProgress ? null : 80m,
            Passed = attemptStatus == AttemptStatus.InProgress ? null : true,
            CreatedAt = now.AddMinutes(-8),
            UpdatedAt = now
        };

        db.Quizzes.Add(quiz);
        db.QuizVersions.Add(quizVersion);
        db.QuizSessions.Add(session);
        db.SessionParticipants.Add(participant);
        db.Attempts.Add(attempt);
        await db.SaveChangesAsync();
        return new SeededAttempt(quizId, session.JoinCode, attempt.Id, rawToken);
    }

    private static async Task<JsonElement> CreateAndPublishSurveyAsync(
        HttpClient client,
        TeacherContext teacher,
        Guid quizId)
    {
        var create = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{teacher.TenantId}/surveys",
            teacher,
            new
            {
                quizId,
                title = "رأيك يهمنا",
                description = "ساعدينا في تحسين التجربة",
                questions = SurveyQuestions()
            }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var draft = await ReadJsonAsync<JsonElement>(create);

        var publish = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{teacher.TenantId}/surveys/{draft.GetProperty("id").GetGuid()}/publish",
            teacher,
            new { baseVersion = draft.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        return await ReadJsonAsync<JsonElement>(publish);
    }

    private static object[] SurveyQuestions() =>
    [
        new { questionType = "Rating", prompt = "ما تقييمك العام؟", isRequired = true, options = Array.Empty<object>() },
        new
        {
            questionType = "SingleChoice",
            prompt = "كيف كان مستوى الاختبار؟",
            isRequired = true,
            options = new[] { new { optionText = "سهل" }, new { optionText = "مناسب" }, new { optionText = "صعب" } }
        },
        new { questionType = "ShortText", prompt = "ما أكثر شيء أعجبك؟", isRequired = false, options = Array.Empty<object>() },
        new { questionType = "Rating", prompt = "ما مدى وضوح الأسئلة؟", isRequired = true, options = Array.Empty<object>() },
        new
        {
            questionType = "SingleChoice",
            prompt = "كيف كان الوقت؟",
            isRequired = true,
            options = new[] { new { optionText = "كافٍ" }, new { optionText = "غير كافٍ" } }
        },
        new { questionType = "ShortText", prompt = "اقتراح للتحسين", isRequired = false, options = Array.Empty<object>() }
    ];

    private static async Task<JsonElement> GetPlayerSurveyAsync(HttpClient client, SeededAttempt seeded)
    {
        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"/api/v1/player/sessions/{seeded.JoinCode}/attempts/{seeded.AttemptId}/survey",
            seeded.RawToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static List<SurveyAnswerPayload> BuildValidAnswers(JsonElement playerSurvey)
    {
        return playerSurvey.GetProperty("questions").EnumerateArray().Select(question =>
        {
            var questionType = question.GetProperty("questionType").GetString();
            return questionType switch
            {
                "Rating" => new SurveyAnswerPayload
                {
                    QuestionId = question.GetProperty("questionId").GetGuid(),
                    RatingValue = 5
                },
                "SingleChoice" => new SurveyAnswerPayload
                {
                    QuestionId = question.GetProperty("questionId").GetGuid(),
                    OptionId = question.GetProperty("options")[0].GetProperty("optionId").GetGuid()
                },
                _ => new SurveyAnswerPayload
                {
                    QuestionId = question.GetProperty("questionId").GetGuid(),
                    Text = "تجربة واضحة ومفيدة"
                }
            };
        }).ToList();
    }

    private static HttpRequestMessage TenantRequest(
        HttpMethod method,
        string path,
        TeacherContext teacher,
        object? payload = null)
    {
        var request = WithAccessToken(new HttpRequestMessage(method, path), teacher.AccessToken);
        request.Headers.Add("X-Tenant-Id", teacher.TenantId.ToString());
        if (payload is not null)
        {
            request.Content = Json(payload);
        }
        return request;
    }

    private static HttpRequestMessage PlayerRequest(
        HttpMethod method,
        string path,
        string rawToken,
        object? payload = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Cookie", $"tp-guest={rawToken}");
        if (payload is not null)
        {
            request.Content = Json(payload);
        }
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

    private sealed record SeededAttempt(Guid QuizId, string JoinCode, Guid AttemptId, string RawToken);

    private sealed class SurveyAnswerPayload
    {
        public Guid QuestionId { get; init; }
        public int? RatingValue { get; set; }
        public Guid? OptionId { get; set; }
        public string? Text { get; init; }
    }
}
