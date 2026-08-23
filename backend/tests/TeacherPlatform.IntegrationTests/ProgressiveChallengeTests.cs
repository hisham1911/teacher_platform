using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات التحدي المتدرج (ProgressiveChallenge) على PostgreSQL حقيقية:
/// إنشاء الجلسة والتحقق من الأنواع المدعومة، منع الانضمام قبل التفعيل،
/// تقدم المستويات الخادمي، إنهاء التحدي عند الخطأ، الاستئناف بعد التحديث،
/// عزل المشاركين، أسئلة الوسائط، التقارير، الاستبيان، والشهادات.
/// </summary>
[Trait("Category", "Integration")]
public class ProgressiveChallengeTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private const string GuestCookieName = "tp-guest";

    public ProgressiveChallengeTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    // ---------- Auth/tenant/bank/question helpers ----------

    private static async Task<string> RegisterConfirmLogin(TestWebApplicationFactory factory, HttpClient client)
    {
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        loginResponse.EnsureSuccessStatusCode();

        var payload = await ReadJson<JsonElement>(loginResponse);
        return payload.GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantFor(HttpClient client, string accessToken)
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = Json(new
                {
                    name = "Challenge Space",
                    slug = $"pc-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankFor(HttpClient client, string accessToken, Guid tenantId)
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/question-banks")
            {
                Content = Json(new { name = "Challenge Bank" })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> UploadAudioAsync(HttpClient client, string accessToken, Guid tenantId)
    {
        // MP3 sync bytes — تُرضي فحص Magic bytes في MediaFileValidator
        var mp3 = new byte[] { 0xFF, 0xFB, 0x90, 0x64 };
        var content = new System.Net.Http.MultipartFormDataContent();
        var file = new ByteArrayContent(mp3);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/mpeg");
        content.Add(file, "file", "clip.mp3");

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = content
        }, accessToken));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await ReadJson<JsonElement>(response);
        return dto.GetProperty("id").GetGuid();
    }

    /// <summary>ينشئ سؤال اختيار من متعدد بخيارين (الأول صحيح).</summary>
    private static async Task<Guid> CreateMcQuestionAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid bankId, string prompt)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt,
                options = new object[] { new { text = "الإجابة الصحيحة", isCorrect = true }, new { text = "إجابة خاطئة", isCorrect = false } }
            })
        }, accessToken));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        return detail.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateQuestionAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        Guid bankId,
        string questionType,
        string prompt,
        object[] options,
        string[]? acceptedAnswers = null,
        Guid? mediaAssetId = null)
    {
        var body = new Dictionary<string, object?>
        {
            ["bankId"] = bankId,
            ["questionType"] = questionType,
            ["prompt"] = prompt,
            ["options"] = options,
            ["acceptedAnswers"] = acceptedAnswers,
            ["mediaAssetId"] = mediaAssetId
        };

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(body)
        }, accessToken));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        return detail.GetProperty("id").GetGuid();
    }

    // ---------- Quiz/session setup helpers ----------

    /// <summary>اختبار منشور بعناصر بالنقاط المحددة بالترتيب.</summary>
    private static Task<Guid> CreatePublishedQuizAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug, params Guid[] questionIds) =>
        CreatePublishedQuizAsync(client, accessToken, tenantId, slug, questionIds, null, null);

    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        string slug,
        IReadOnlyCollection<Guid> questionIds,
        string? timeMode,
        int? timeLimitSeconds)
    {
        var createResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "تحدي متدرج", slug, description = "وصف" })
        }, accessToken));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var quizId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        foreach (var questionId in questionIds)
        {
            var addResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
            {
                Content = Json(new { questionId, points = 5, isRequired = true })
            }, accessToken));
            Assert.Equal(HttpStatusCode.OK, addResponse.StatusCode);
        }

        var draftResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft"), accessToken));
        var draft = await ReadJson<JsonElement>(draftResponse);
        if (timeMode is not null)
        {
            var updateResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Put,
                $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft")
            {
                Content = Json(new
                {
                    title = "تحدي متدرج",
                    description = "وصف",
                    instructions = "تعليمات",
                    passingPercentage = 50,
                    timeMode,
                    timeLimitSeconds,
                    shuffleQuestions = false,
                    shuffleOptions = false,
                    theme = new
                    {
                        template = "default",
                        primaryColor = "#2563eb",
                        secondaryColor = "#7c3aed",
                        backgroundColor = "#ffffff"
                    },
                    baseVersion = draft.GetProperty("version").GetUInt32()
                })
            }, accessToken));
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            draft = await ReadJson<JsonElement>(updateResponse);
        }

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        return quizId;
    }

    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> NewChallengeAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug, params Guid[] questionIds)
    {
        var quizId = await CreatePublishedQuizAsync(client, accessToken, tenantId, slug, questionIds);
        return await ActivateChallengeAsync(client, accessToken, tenantId, quizId);
    }

    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> NewPerQuestionChallengeAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        string slug,
        IReadOnlyCollection<Guid> questionIds,
        int timeLimitSeconds)
    {
        var quizId = await CreatePublishedQuizAsync(
            client, accessToken, tenantId, slug, questionIds, "PerQuestion", timeLimitSeconds);
        return await ActivateChallengeAsync(client, accessToken, tenantId, quizId);
    }

    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> ActivateChallengeAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId)
    {
        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "ProgressiveChallenge", label = "تحدٍّ الصباح" })
        }, accessToken));
        Assert.Equal(HttpStatusCode.Created, sessionResponse.StatusCode);
        var session = await ReadJson<JsonElement>(sessionResponse);
        Assert.Equal("ProgressiveChallenge", session.GetProperty("mode").GetString());

        var activateResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{session.GetProperty("id").GetGuid()}/activate")
        {
            Content = Json(new { baseVersion = session.GetProperty("version").GetUInt32() })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, activateResponse.StatusCode);

        return (quizId, session.GetProperty("id").GetGuid(), session.GetProperty("joinCode").GetString()!);
    }

    /// <summary>تحدٍّ قياسي من ثلاثة أسئلة اختيار متعدد (5 نقاط لكل مستوى).</summary>
    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> NewThreeLevelChallengeAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug)
    {
        var bankId = await CreateBankFor(client, accessToken, tenantId);
        var questions = new List<Guid>();
        for (var i = 1; i <= 3; i++)
        {
            questions.Add(await CreateMcQuestionAsync(client, accessToken, tenantId, bankId, $"مستوى رقم {i}"));
        }

        return await NewChallengeAsync(client, accessToken, tenantId, slug, questions.ToArray());
    }

    // ---------- Player helpers ----------

    private static async Task<(JsonElement Payload, string GuestToken)> JoinAsync(
        HttpClient client, string joinCode, string displayName, string? guestToken = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/player/sessions/{joinCode}/join")
        {
            Content = Json(new { displayName })
        };
        if (guestToken is not null)
        {
            request.Headers.Add("Cookie", $"{GuestCookieName}={guestToken}");
        }

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJson<JsonElement>(response);

        var token = guestToken;
        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            var cookie = setCookies.Single(v => v.StartsWith($"{GuestCookieName}=", StringComparison.Ordinal));
            token = cookie.Split(';')[0].Substring(GuestCookieName.Length + 1);
        }

        Assert.False(string.IsNullOrEmpty(token));
        return (payload, token!);
    }

    private static HttpRequestMessage PlayerRequest(HttpMethod method, string url, string guestToken, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{GuestCookieName}={guestToken}");
        if (body is not null)
        {
            request.Content = Json(body);
        }

        return request;
    }

    private static async Task<JsonElement> StartAttemptAsync(HttpClient client, string joinCode, string guestToken)
    {
        var response = await client.SendAsync(
            PlayerRequest(HttpMethod.Post, $"/api/v1/player/sessions/{joinCode}/attempts", guestToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> GetCurrentQuestionAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken)
    {
        var response = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question", guestToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    /// <summary>يثبت خيارًا من السؤال الحالي: الفهرس 0 هو الصحيح (لا خلط افتراضيًا).</summary>
    private static async Task<JsonElement> SubmitOptionAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken, int optionIndex)
    {
        var question = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        var optionId = question.GetProperty("options")[optionIndex].GetProperty("optionId").GetString();
        var response = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = question.GetProperty("quizVersionItemId").GetGuid(), answerJson = JsonSerializer.Serialize(new { optionId }, JsonOptions) }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<HttpResponseMessage> TrySubmitOptionAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken, int optionIndex)
    {
        var question = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        var optionId = question.GetProperty("options")[optionIndex].GetProperty("optionId").GetString();
        return await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = question.GetProperty("quizVersionItemId").GetGuid(), answerJson = JsonSerializer.Serialize(new { optionId }, JsonOptions) }));
    }

    private static async Task<HttpResponseMessage> GetResultRawAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken)
    {
        return await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/result", guestToken));
    }

    private static async Task<JsonElement> GetResultAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken)
    {
        var response = await GetResultRawAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static HttpRequestMessage WithAccessToken(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return request;
    }

    private static async Task<T> ReadJson<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }

    /// <summary>يعيد فهرس السؤال الحالي من استجابة current-question.</summary>
    private static async Task<int> CurrentLevelAsync(HttpClient client, string joinCode, Guid attemptId, string guestToken)
    {
        var question = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        return question.GetProperty("index").GetInt32();
    }

    private async Task BackdateAttemptAsync(Guid tenantId, Guid attemptId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
        tenantContext.SetResolved(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Attempts
            .Where(attempt => attempt.Id == attemptId)
            .ExecuteUpdateAsync(update => update.SetProperty(
                attempt => attempt.UpdatedAt,
                DateTime.UtcNow.AddMinutes(-2)));
    }

    // ---------- الاختبارات: الإنشاء والقيود ----------

    [Fact]
    public async Task CreateSession_ProgressiveChallenge_PersistsMode_AndActivates()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var question = await CreateMcQuestionAsync(client, token, tenantId, bankId, "سؤال وحيد");
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, $"pc-create-{Guid.NewGuid():N}"[..20], question);

        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "ProgressiveChallenge", label = "تحدٍّ" })
        }, token));

        Assert.Equal(HttpStatusCode.Created, sessionResponse.StatusCode);
        var session = await ReadJson<JsonElement>(sessionResponse);
        Assert.Equal("ProgressiveChallenge", session.GetProperty("mode").GetString());
        Assert.Equal("Scheduled", session.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(session.GetProperty("joinCode").GetString()));
    }

    [Fact]
    public async Task CreateSession_ProgressiveChallenge_WithShortAnswerOrOrdering_Returns409()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var mc = await CreateMcQuestionAsync(client, token, tenantId, bankId, "سؤال مقبول");
        var shortAnswer = await CreateQuestionAsync(
            client, token, tenantId, bankId, "ShortAnswer", "اكتب عاصمة مصر",
            Array.Empty<object>(), acceptedAnswers: new[] { "القاهرة" });
        var ordering = await CreateQuestionAsync(
            client, token, tenantId, bankId, "Ordering", "رتّب",
            new object[] { new { text = "1" }, new { text = "2" } });
        var quizId = await CreatePublishedQuizAsync(
            client, token, tenantId, $"pc-bad-{Guid.NewGuid():N}"[..20], mc, shortAnswer, ordering);

        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "ProgressiveChallenge" })
        }, token));

        Assert.Equal(HttpStatusCode.Conflict, sessionResponse.StatusCode);
        var error = await ReadJson<JsonElement>(sessionResponse);
        Assert.Equal("UnsupportedQuestionTypesForMode", error.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Player_CannotJoin_OrStart_BeforeActivation()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var question = await CreateMcQuestionAsync(client, token, tenantId, bankId, "سؤال الانتظار");
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, $"pc-sched-{Guid.NewGuid():N}"[..20], question);

        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "ProgressiveChallenge" })
        }, token));
        sessionResponse.EnsureSuccessStatusCode();
        var session = await ReadJson<JsonElement>(sessionResponse);
        var joinCode = session.GetProperty("joinCode").GetString()!;

        var player = NewClient();
        var joinAttempt = await player.PostAsync($"/api/v1/player/sessions/{joinCode}/join", Json(new { displayName = "طالب مبكر" }));
        Assert.Equal(HttpStatusCode.Conflict, joinAttempt.StatusCode);
    }

    // ---------- الاختبارات: التقدم والإنهاء ----------

    [Fact]
    public async Task Correct_Answer_Advances_To_Next_Level()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-adv-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "متصدٍ");
        var attempt = await StartAttemptAsync(client, joinCode, guestToken);
        var attemptId = attempt.GetProperty("attemptId").GetGuid();

        Assert.Equal(0, await CurrentLevelAsync(client, joinCode, attemptId, guestToken));

        var saved = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        Assert.True(saved.GetProperty("isCorrect").GetBoolean());
        Assert.Equal(5m, saved.GetProperty("scoreAwarded").GetDecimal());

        // المستوى الثاني هو السؤال الحالي الآن — ترتيب النسخة هو سلم المستويات
        var next = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal(1, next.GetProperty("index").GetInt32());
        Assert.Equal("مستوى رقم 2", next.GetProperty("prompt").GetString());
    }

    [Fact]
    public async Task Wrong_Answer_On_First_Level_Ends_Challenge_Immediately()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-wrong1-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "متسرع");
        var attempt = await StartAttemptAsync(client, joinCode, guestToken);
        var attemptId = attempt.GetProperty("attemptId").GetGuid();

        var saved = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 1);
        Assert.False(saved.GetProperty("isCorrect").GetBoolean());

        var result = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("Finished", result.GetProperty("status").GetString());
        Assert.Equal(1, result.GetProperty("answeredCount").GetInt32());
        Assert.Equal(3, result.GetProperty("totalQuestions").GetInt32());
        Assert.Equal(0m, result.GetProperty("score").GetDecimal());
        Assert.False(result.GetProperty("passed").GetBoolean());

        // لا مزيد من الأسئلة بعد انتهاء التحدي
        var rejected = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question", guestToken));
        Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
    }

    [Fact]
    public async Task Wrong_Answer_Midway_Keeps_Earned_Score_And_Fails()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-mid-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "صاعد ثم وقع");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        var first = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        Assert.True(first.GetProperty("isCorrect").GetBoolean());

        var second = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 1);
        Assert.False(second.GetProperty("isCorrect").GetBoolean());

        var result = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("Finished", result.GetProperty("status").GetString());
        Assert.Equal(2, result.GetProperty("answeredCount").GetInt32());
        Assert.Equal(5m, result.GetProperty("score").GetDecimal());
        Assert.Equal(15m, result.GetProperty("maxScore").GetDecimal());
        // نقطة واحدة صحيحة من ثلاثة مستويات ⇒ أقل من نسبة النجاح الافتراضية 50%
        Assert.False(result.GetProperty("passed").GetBoolean());
    }

    [Fact]
    public async Task Completing_All_Levels_Finishes_As_Completed_And_Passed()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-win-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "بطل التحدي");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        for (var level = 0; level < 3; level++)
        {
            var saved = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
            Assert.True(saved.GetProperty("isCorrect").GetBoolean());
        }

        var result = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("Finished", result.GetProperty("status").GetString());
        Assert.Equal(3, result.GetProperty("answeredCount").GetInt32());
        Assert.Equal(15m, result.GetProperty("score").GetDecimal());
        Assert.Equal(100m, result.GetProperty("percentage").GetDecimal());
        Assert.True(result.GetProperty("passed").GetBoolean());

        var finalQuestion = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question", guestToken));
        Assert.Equal(HttpStatusCode.Conflict, finalQuestion.StatusCode);
    }

    [Fact]
    public async Task PerQuestion_Deadline_Blocks_Direct_Submit_Refresh_And_Finish()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questions = new[]
        {
            await CreateMcQuestionAsync(client, token, tenantId, bankId, "المستوى المؤقت الأول"),
            await CreateMcQuestionAsync(client, token, tenantId, bankId, "المستوى المؤقت الثاني")
        };
        var (_, _, joinCode) = await NewPerQuestionChallengeAsync(
            client, token, tenantId, $"pc-time-{Guid.NewGuid():N}"[..20], questions, timeLimitSeconds: 30);

        var (_, directToken) = await JoinAsync(NewClient(), joinCode, "إرسال مباشر متأخر");
        var directAttempt = (await StartAttemptAsync(client, joinCode, directToken)).GetProperty("attemptId").GetGuid();
        var accepted = await SubmitOptionAsync(client, joinCode, directAttempt, directToken, optionIndex: 0);
        var secondQuestion = await GetCurrentQuestionAsync(client, joinCode, directAttempt, directToken);
        var fullInterval = secondQuestion.GetProperty("deadlineAt").GetDateTime() -
            accepted.GetProperty("serverNow").GetDateTime();
        Assert.InRange(fullInterval.TotalSeconds, 29.9, 30.1);

        await BackdateAttemptAsync(tenantId, directAttempt);
        var directLate = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{directAttempt}/answers", directToken,
            new
            {
                quizVersionItemId = secondQuestion.GetProperty("quizVersionItemId").GetGuid(),
                answerJson = JsonSerializer.Serialize(new
                {
                    optionId = secondQuestion.GetProperty("options")[0].GetProperty("optionId").GetGuid()
                }, JsonOptions)
            }));
        Assert.Equal(HttpStatusCode.Conflict, directLate.StatusCode);
        Assert.Equal("AttemptFinished", (await ReadJson<JsonElement>(directLate)).GetProperty("title").GetString());
        var directResult = await GetResultAsync(client, joinCode, directAttempt, directToken);
        Assert.Equal("TimedOut", directResult.GetProperty("status").GetString());
        Assert.Equal(1, directResult.GetProperty("answeredCount").GetInt32());
        Assert.Equal(5m, directResult.GetProperty("score").GetDecimal());

        var (_, refreshToken) = await JoinAsync(NewClient(), joinCode, "تحديث متأخر");
        var refreshAttempt = (await StartAttemptAsync(client, joinCode, refreshToken)).GetProperty("attemptId").GetGuid();
        await BackdateAttemptAsync(tenantId, refreshAttempt);
        var refresh = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{refreshAttempt}/current-question", refreshToken));
        Assert.Equal(HttpStatusCode.Conflict, refresh.StatusCode);
        Assert.Equal("TimedOut", (await GetResultAsync(client, joinCode, refreshAttempt, refreshToken))
            .GetProperty("status").GetString());

        var (_, finishToken) = await JoinAsync(NewClient(), joinCode, "إنهاء متأخر");
        var finishAttempt = (await StartAttemptAsync(client, joinCode, finishToken)).GetProperty("attemptId").GetGuid();
        await BackdateAttemptAsync(tenantId, finishAttempt);
        var finish = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{finishAttempt}/finish", finishToken));
        Assert.Equal(HttpStatusCode.OK, finish.StatusCode);
        Assert.Equal("TimedOut", (await ReadJson<JsonElement>(finish)).GetProperty("status").GetString());
    }

    // ---------- الاختبارات: بوابات الحماية ----------

    [Fact]
    public async Task Future_Level_Submission_Returns_NotCurrentLevel_WithoutMutation()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, sessionId, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-gate-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "متجاوز المستويات");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        Guid futureItemId;
        Guid futureValidOptionId;
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
            tenantContext.SetResolved(tenantId);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var sessionVersionId = await db.QuizSessions
                .AsNoTracking()
                .Where(session => session.Id == sessionId)
                .Select(session => session.QuizVersionId)
                .SingleAsync();
            var futureItem = await db.QuizVersionItems
                .AsNoTracking()
                .Include(item => item.QuestionVersion!)
                    .ThenInclude(question => question.Options)
                .Where(item => item.QuizVersionId == sessionVersionId)
                .OrderBy(item => item.SortOrder)
                .Skip(1)
                .FirstAsync();
            futureItemId = futureItem.Id;
            futureValidOptionId = futureItem.QuestionVersion!.Options.OrderBy(option => option.SortOrder).First().Id;
        }

        var response = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new
            {
                quizVersionItemId = futureItemId,
                answerJson = JsonSerializer.Serialize(new { optionId = futureValidOptionId }, JsonOptions)
            }));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("NotCurrentLevel", (await ReadJson<JsonElement>(response)).GetProperty("title").GetString());
        var state = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("InProgress", state.GetProperty("status").GetString());
        Assert.Equal(0, state.GetProperty("answeredCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, state.GetProperty("score").ValueKind);
        Assert.Equal(0, await CurrentLevelAsync(client, joinCode, attemptId, guestToken));
    }

    [Fact]
    public async Task Score_Is_Server_Derived_Replay_Does_Not_Double_Count()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-score-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "معيد الإرسال");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        // أول إرسال صحيح: الحقول العميلية الإضافية لا تغيّر التصحيح أو النقاط الخادمية.
        var firstQuestion = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal(0, firstQuestion.GetProperty("index").GetInt32());
        var correctOptionId = firstQuestion.GetProperty("options")[0].GetProperty("optionId").GetString();
        var firstItemId = firstQuestion.GetProperty("quizVersionItemId").GetGuid();
        var firstResponse = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new
            {
                quizVersionItemId = firstItemId,
                answerJson = JsonSerializer.Serialize(new { optionId = correctOptionId }, JsonOptions),
                isCorrect = false,
                scoreAwarded = 999_999
            }));
        firstResponse.EnsureSuccessStatusCode();
        var firstSaved = await ReadJson<JsonElement>(firstResponse);
        Assert.True(firstSaved.GetProperty("isCorrect").GetBoolean());
        Assert.Equal(5m, firstSaved.GetProperty("scoreAwarded").GetDecimal());

        // إعادة مستوى قديم بنفس الحمولة Idempotent ولا تضاعف النقاط.
        var replayResponse = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = firstItemId, answerJson = JsonSerializer.Serialize(new { optionId = correctOptionId }, JsonOptions) }));
        Assert.Equal(HttpStatusCode.OK, replayResponse.StatusCode);
        Assert.Equal(5m, (await ReadJson<JsonElement>(replayResponse)).GetProperty("scoreAwarded").GetDecimal());

        await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        var finalQuestion = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        var finalItemId = finalQuestion.GetProperty("quizVersionItemId").GetGuid();
        var finalCorrectOptionId = finalQuestion.GetProperty("options")[0].GetProperty("optionId").GetString();
        var finalWrongOptionId = finalQuestion.GetProperty("options")[1].GetProperty("optionId").GetString();
        var finalAnswerJson = JsonSerializer.Serialize(new { optionId = finalCorrectOptionId }, JsonOptions);
        var terminal = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = finalItemId, answerJson = finalAnswerJson }));
        Assert.Equal(HttpStatusCode.OK, terminal.StatusCode);

        // إعادة الإجابة النهائية بعد إنهاء المحاولة تبقى Idempotent، والمختلفة تتعارض.
        var terminalReplay = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = finalItemId, answerJson = finalAnswerJson }));
        Assert.Equal(HttpStatusCode.OK, terminalReplay.StatusCode);
        Assert.Equal(5m, (await ReadJson<JsonElement>(terminalReplay)).GetProperty("scoreAwarded").GetDecimal());

        var conflictingReplay = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new
            {
                quizVersionItemId = finalItemId,
                answerJson = JsonSerializer.Serialize(new { optionId = finalWrongOptionId }, JsonOptions)
            }));
        Assert.Equal(HttpStatusCode.Conflict, conflictingReplay.StatusCode);
        Assert.Equal("AnswerConflict", (await ReadJson<JsonElement>(conflictingReplay)).GetProperty("title").GetString());

        var result = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal(15m, result.GetProperty("score").GetDecimal());
        Assert.Equal(3, result.GetProperty("answeredCount").GetInt32());
    }

    // ---------- الاختبارات: الاستئناف والعزل ----------

    [Fact]
    public async Task Refresh_Resumes_At_Saved_Level_With_ScoreSoFar()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-resume-{Guid.NewGuid():N}"[..20]);

        var (playerState, guestToken) = await JoinAsync(NewClient(), joinCode, "منقطع الاتصال");
        var participantId = playerState.GetProperty("participantId").GetGuid();
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        var saved = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        Assert.True(saved.GetProperty("isCorrect").GetBoolean());

        // F5: /me من الكوكي يعيد نفس المشارك ومحاولته الجارية
        var me = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/me", guestToken));
        me.EnsureSuccessStatusCode();
        var meState = await ReadJson<JsonElement>(me);
        Assert.Equal(participantId, meState.GetProperty("participantId").GetGuid());
        Assert.Equal(attemptId, meState.GetProperty("attemptId").GetGuid());
        Assert.Equal("InProgress", meState.GetProperty("attemptStatus").GetString());

        // بدء المحاولة Idempotent يعيد المحاولة نفسها بمستواها ونقاطها
        var resumed = await StartAttemptAsync(client, joinCode, guestToken);
        Assert.Equal(attemptId, resumed.GetProperty("attemptId").GetGuid());
        Assert.Equal(1, resumed.GetProperty("currentQuestionIndex").GetInt32());
        Assert.Equal(5m, resumed.GetProperty("scoreSoFar").GetDecimal());

        // والسؤال الحالي هو المستوى الثاني وليس الأول
        Assert.Equal(1, await CurrentLevelAsync(client, joinCode, attemptId, guestToken));
    }

    [Fact]
    public async Task Two_Participants_In_One_Session_No_State_Leakage()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-iso-{Guid.NewGuid():N}"[..20]);

        var playerA = NewClient();
        var playerB = NewClient();
        var (stateA, tokenA) = await JoinAsync(playerA, joinCode, "الأول");
        var (stateB, tokenB) = await JoinAsync(playerB, joinCode, "الثاني");
        Assert.NotEqual(stateA.GetProperty("participantId").GetGuid(), stateB.GetProperty("participantId").GetGuid());

        var attemptA = (await StartAttemptAsync(playerA, joinCode, tokenA)).GetProperty("attemptId").GetGuid();
        var attemptB = (await StartAttemptAsync(playerB, joinCode, tokenB)).GetProperty("attemptId").GetGuid();
        Assert.NotEqual(attemptA, attemptB);

        var crossAttempt = await playerA.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptB}/current-question", tokenA));
        Assert.Equal(HttpStatusCode.NotFound, crossAttempt.StatusCode);

        // الأول يجيب صحيحًا ويصعد
        var savedA = await SubmitOptionAsync(playerA, joinCode, attemptA, tokenA, optionIndex: 0);
        Assert.True(savedA.GetProperty("isCorrect").GetBoolean());
        Assert.Equal(1, await CurrentLevelAsync(playerA, joinCode, attemptA, tokenA));

        // الثاني ما زال على المستوى الأول — لا تسريب حالة
        Assert.Equal(0, await CurrentLevelAsync(playerB, joinCode, attemptB, tokenB));
        var savedB = await SubmitOptionAsync(playerB, joinCode, attemptB, tokenB, optionIndex: 0);
        Assert.True(savedB.GetProperty("isCorrect").GetBoolean());

        // الأول يخطئ فينتهي تحديه فقط
        var wrongA = await SubmitOptionAsync(playerA, joinCode, attemptA, tokenA, optionIndex: 1);
        Assert.False(wrongA.GetProperty("isCorrect").GetBoolean());
        var resultA = await GetResultAsync(playerA, joinCode, attemptA, tokenA);
        Assert.Equal("Finished", resultA.GetProperty("status").GetString());

        // والثاني ما زال يتقدم باستقلالية
        Assert.Equal(1, await CurrentLevelAsync(playerB, joinCode, attemptB, tokenB));
        var resultB = await GetResultAsync(playerB, joinCode, attemptB, tokenB);
        Assert.Equal("InProgress", resultB.GetProperty("status").GetString());
    }

    // ---------- الاختبارات: الوسائط ----------

    [Fact]
    public async Task Listening_Question_With_Audio_Works_End_To_End()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var audioId = await UploadAudioAsync(client, token, tenantId);
        var listening = await CreateQuestionAsync(
            client, token, tenantId, bankId, "Listening", "استمع واختر الكلمة الصحيحة",
            new object[] { new { text = "شكرًا", isCorrect = true }, new { text = "آسف", isCorrect = false } },
            mediaAssetId: audioId);
        var (_, _, joinCode) = await NewChallengeAsync(client, token, tenantId, $"pc-audio-{Guid.NewGuid():N}"[..20], listening);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "مستمع");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        var question = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("Listening", question.GetProperty("questionType").GetString());
        Assert.False(question.GetProperty("mediaAssetId").ValueKind is JsonValueKind.Null or JsonValueKind.Undefined);

        // وسيط السؤال متاح أثناء كونه المستوى الحالي فقط.
        var mediaResponse = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/media/{audioId}", guestToken));
        Assert.Equal(HttpStatusCode.OK, mediaResponse.StatusCode);

        var saved = await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        Assert.True(saved.GetProperty("isCorrect").GetBoolean());

        // المستوى الأخير والأخير صحيح ⇒ اكتمل التحدي
        var result = await GetResultAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal("Finished", result.GetProperty("status").GetString());
        Assert.True(result.GetProperty("passed").GetBoolean());

        var mediaAfterFinish = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/media/{audioId}", guestToken));
        Assert.Equal(HttpStatusCode.NotFound, mediaAfterFinish.StatusCode);
    }

    [Fact]
    public async Task Future_Level_Media_Is_Blocked_Until_Level_Becomes_Current()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var first = await CreateMcQuestionAsync(client, token, tenantId, bankId, "مستوى بلا وسيط");
        var futureAudioId = await UploadAudioAsync(client, token, tenantId);
        var futureListening = await CreateQuestionAsync(
            client,
            token,
            tenantId,
            bankId,
            "Listening",
            "استمع في المستوى الثاني",
            new object[] { new { text = "صحيح", isCorrect = true }, new { text = "خطأ", isCorrect = false } },
            mediaAssetId: futureAudioId);
        var (_, _, joinCode) = await NewChallengeAsync(
            client, token, tenantId, $"pc-media-{Guid.NewGuid():N}"[..20], first, futureListening);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "مستمع فضولي");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();

        var blocked = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/media/{futureAudioId}", guestToken));
        Assert.Equal(HttpStatusCode.NotFound, blocked.StatusCode);

        await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        var revealed = await GetCurrentQuestionAsync(client, joinCode, attemptId, guestToken);
        Assert.Equal(futureAudioId, revealed.GetProperty("mediaAssetId").GetGuid());
        var allowed = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/media/{futureAudioId}", guestToken));
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    // ---------- الاختبارات: التقارير ----------

    [Fact]
    public async Task Report_Shows_Mode_MaxLevel_TotalLevels_And_CsvColumn()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (quizId, sessionId, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-rep-{Guid.NewGuid():N}"[..20]);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "مُبلَّغ عنه");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();
        await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 0);
        await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 1); // خطأ في المستوى الثاني ⇒ نهاية

        var reportResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{sessionId}/report"), token));
        Assert.Equal(HttpStatusCode.OK, reportResponse.StatusCode);
        var report = await ReadJson<JsonElement>(reportResponse);
        Assert.Equal("ProgressiveChallenge", report.GetProperty("sessionMode").GetString());

        var attemptsListResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{sessionId}/attempts"), token));
        attemptsListResponse.EnsureSuccessStatusCode();
        var attemptsList = await ReadJson<JsonElement>(attemptsListResponse);
        var listItem = attemptsList.GetProperty("items").EnumerateArray().Single();
        Assert.Equal("ProgressiveChallenge", listItem.GetProperty("mode").GetString());
        Assert.Equal(2, listItem.GetProperty("maxLevelReached").GetInt32());

        var detailResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/attempts/{attemptId}"), token));
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await ReadJson<JsonElement>(detailResponse);
        Assert.Equal("ProgressiveChallenge", detail.GetProperty("mode").GetString());
        Assert.Equal(2, detail.GetProperty("maxLevelReached").GetInt32());
        Assert.Equal(3, detail.GetProperty("totalLevels").GetInt32());

        var csvResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/sessions/{sessionId}/report/export.csv"), token));
        Assert.Equal(HttpStatusCode.OK, csvResponse.StatusCode);
        var csv = await csvResponse.Content.ReadAsStringAsync();
        Assert.Contains("MaxLevelReached", csv);
        // كل الحقول مقتبسة: Passed=False ثم MaxLevelReached=2 في صف البيانات
        Assert.Contains("\"False\",\"2\"", csv);
    }

    // ---------- الاختبارات: الاستبيان والشهادة ----------

    [Fact]
    public async Task Survey_Available_After_Challenge_Ends_Even_On_Failure()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (quizId, _, joinCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-survey-{Guid.NewGuid():N}"[..20]);

        var surveyCreate = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/surveys")
        {
            Content = Json(new
            {
                quizId,
                title = "رأيك في التحدي",
                questions = new object[] { new { questionType = "Rating", prompt = "كم استمتعت؟", isRequired = true, options = Array.Empty<object>() } }
            })
        }, token));
        Assert.Equal(HttpStatusCode.Created, surveyCreate.StatusCode);
        var surveyDraft = await ReadJson<JsonElement>(surveyCreate);
        var publish = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/surveys/{surveyDraft.GetProperty("id").GetGuid()}/publish")
        {
            Content = Json(new { baseVersion = surveyDraft.GetProperty("version").GetUInt32() })
        }, token));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);

        var (_, guestToken) = await JoinAsync(NewClient(), joinCode, "رايق");
        var attemptId = (await StartAttemptAsync(client, joinCode, guestToken)).GetProperty("attemptId").GetGuid();
        await SubmitOptionAsync(client, joinCode, attemptId, guestToken, optionIndex: 1); // خسارة فورية

        var surveyResponse = await client.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/survey", guestToken));
        Assert.Equal(HttpStatusCode.OK, surveyResponse.StatusCode);
        var survey = await ReadJson<JsonElement>(surveyResponse);
        var ratingQuestion = survey.GetProperty("questions").EnumerateArray().Single();

        var submit = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/survey", guestToken,
            new
            {
                answers = new[] { new { questionId = ratingQuestion.GetProperty("questionId").GetGuid(), ratingValue = 5 } }
            }));
        Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
    }

    [Fact]
    public async Task Certificate_Issued_For_Passing_Run_And_Refused_For_Failing_Run()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);

        // تشغيل ناجح: يكمل كل المستويات ⇒ مستحق للشهادة
        var (_, _, winningCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-cert-w-{Guid.NewGuid():N}"[..20]);
        var (_, winnerToken) = await JoinAsync(NewClient(), winningCode, "الفائز");
        var winnerAttempt = (await StartAttemptAsync(client, winningCode, winnerToken)).GetProperty("attemptId").GetGuid();
        for (var level = 0; level < 3; level++)
        {
            await SubmitOptionAsync(client, winningCode, winnerAttempt, winnerToken, optionIndex: 0);
        }

        var certificate = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{winningCode}/attempts/{winnerAttempt}/certificate", winnerToken));
        Assert.True(certificate.IsSuccessStatusCode);
        var certificateState = await ReadJson<JsonElement>(certificate);
        Assert.Contains(certificateState.GetProperty("status").GetString(), new[] { "Pending", "Ready" });

        // خطأ المستوى الأخير يفشل التحدي حتى لو تجاوزت درجتا أول مستويين عتبة 50%.
        var (_, _, losingCode) = await NewThreeLevelChallengeAsync(client, token, tenantId, $"pc-cert-l-{Guid.NewGuid():N}"[..20]);
        var (_, loserToken) = await JoinAsync(NewClient(), losingCode, "الخاسر في النهاية");
        var loserAttempt = (await StartAttemptAsync(client, losingCode, loserToken)).GetProperty("attemptId").GetGuid();
        await SubmitOptionAsync(client, losingCode, loserAttempt, loserToken, optionIndex: 0);
        await SubmitOptionAsync(client, losingCode, loserAttempt, loserToken, optionIndex: 0);
        await SubmitOptionAsync(client, losingCode, loserAttempt, loserToken, optionIndex: 1);
        var losingResult = await GetResultAsync(client, losingCode, loserAttempt, loserToken);
        Assert.Equal(10m, losingResult.GetProperty("score").GetDecimal());
        Assert.True(losingResult.GetProperty("percentage").GetDecimal() >= 50m);
        Assert.False(losingResult.GetProperty("passed").GetBoolean());

        var refused = await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{losingCode}/attempts/{loserAttempt}/certificate", loserToken));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        var refusedError = await ReadJson<JsonElement>(refused);
        Assert.Equal("CertificateNotEligible", refusedError.GetProperty("title").GetString());
    }
}
