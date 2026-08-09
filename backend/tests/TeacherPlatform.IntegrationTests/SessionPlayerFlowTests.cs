using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات Phase 4 الشاملة على PostgreSQL حقيقية:
/// دورة حياة الجلسة (إنشاء/تفعيل/إنهاء/إلغاء)، انضمام اللاعب وأمان رمز الضيف،
/// بدء المحاولة والاستئناف، DTO آمن بلا تسريب إجابات، تسجيل الإجابات مع Idempotency،
/// الإنهاء والنتيجة، والعزل بين المستأجرين.
/// </summary>
[Trait("Category", "Integration")]
public class SessionPlayerFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>اسم كوكي الضيف في بيئة الاختبار (UseSecureCookie=false ⇒ الاسم غير الصارم).</summary>
    private const string GuestCookieName = "tp-guest";

    public SessionPlayerFlowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    // ---------- Auth/tenant/quiz helpers (نفس أنماط QuizWorkflowTests) ----------

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
                    name = "Session Space",
                    slug = $"ss-{Guid.NewGuid():N}"[..20],
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
                Content = Json(new { name = "Session Bank" })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

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
                options = new object[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } }
            })
        }, accessToken));

        response.EnsureSuccessStatusCode();
        var detail = await ReadJson<JsonElement>(response);
        return detail.GetProperty("id").GetGuid();
    }

    /// <summary>ينشئ اختبارًا بسؤالين MC (5 نقاط لكل سؤال) وينشره، ويعيد quizId.</summary>
    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug)
    {
        var bankId = await CreateBankFor(client, accessToken, tenantId);
        var q1 = await CreateMcQuestionAsync(client, accessToken, tenantId, bankId, "سؤال أول");
        var q2 = await CreateMcQuestionAsync(client, accessToken, tenantId, bankId, "سؤال ثاني");

        var createResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "اختبار الجلسات", slug, description = "وصف" })
        }, accessToken));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var quizId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        foreach (var questionId in new[] { q1, q2 })
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
        var baseVersion = (await ReadJson<JsonElement>(draftResponse)).GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        return quizId;
    }

    // ---------- Session helpers ----------

    private static async Task<Guid> CreateSessionAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId, string mode = "SelfPaced")
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode, label = "حصة الصباح" })
        }, accessToken));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> GetSessionAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId, Guid sessionId)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}"), accessToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> ActivateSessionAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId, Guid sessionId, uint baseVersion)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate")
        {
            Content = Json(new { baseVersion })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    /// <summary>ينشئ اختبارًا منشورًا وجلسة مفعّلة، ويعيد (quizId, sessionId, joinCode).</summary>
    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> CreateActiveSessionAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug)
    {
        var quizId = await CreatePublishedQuizAsync(client, accessToken, tenantId, slug);
        var sessionId = await CreateSessionAsync(client, accessToken, tenantId, quizId);
        var session = await GetSessionAsync(client, accessToken, tenantId, quizId, sessionId);
        await ActivateSessionAsync(client, accessToken, tenantId, quizId, sessionId,
            session.GetProperty("version").GetUInt32());
        return (quizId, sessionId, session.GetProperty("joinCode").GetString()!);
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

    // ---------- دورة حياة الجلسة ----------

    [Fact]
    public async Task CreateSession_Succeeds_WithScheduledStatus_AndJoinCode()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-create-1");

        var sessionId = await CreateSessionAsync(client, token, tenantId, quizId);

        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        Assert.Equal("Scheduled", session.GetProperty("status").GetString());
        Assert.Equal("SelfPaced", session.GetProperty("mode").GetString());
        Assert.False(string.IsNullOrWhiteSpace(session.GetProperty("joinCode").GetString()));
        Assert.Equal(1, session.GetProperty("quizVersionNumber").GetInt32());
        Assert.Equal("حصة الصباح", session.GetProperty("label").GetString());
    }

    [Fact]
    public async Task CreateSession_LiveMode_CreatesServerSideLiveState()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-live-1");

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "Live" })
        }, token));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = await ReadJson<JsonElement>(response);
        Assert.Equal("Live", session.GetProperty("mode").GetString());
        Assert.Equal("Scheduled", session.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Activate_ThenFinish_TransitionsStatus()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-flow-1");
        var sessionId = await CreateSessionAsync(client, token, tenantId, quizId);

        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        var activated = await ActivateSessionAsync(
            client, token, tenantId, quizId, sessionId, session.GetProperty("version").GetUInt32());
        Assert.Equal("Active", activated.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, activated.GetProperty("activatedAt").ValueKind);

        var finishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/finish")
        {
            Content = Json(new { baseVersion = activated.GetProperty("version").GetUInt32() })
        }, token));
        Assert.Equal(HttpStatusCode.OK, finishResponse.StatusCode);
        var finished = await ReadJson<JsonElement>(finishResponse);
        Assert.Equal("Finished", finished.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, finished.GetProperty("finishedAt").ValueKind);
    }

    [Fact]
    public async Task Activate_StaleBaseVersion_Returns409()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-conc-1");
        var sessionId = await CreateSessionAsync(client, token, tenantId, quizId);

        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        var version = session.GetProperty("version").GetUInt32();
        await ActivateSessionAsync(client, token, tenantId, quizId, sessionId, version);

        // نفس baseVersion مرة ثانية — الصف تغيّر ⇒ 409
        var secondResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate")
        {
            Content = Json(new { baseVersion = version })
        }, token));
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task Cancel_ScheduledSession_Succeeds()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-cancel-1");
        var sessionId = await CreateSessionAsync(client, token, tenantId, quizId);

        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/cancel")
        {
            Content = Json(new { baseVersion = session.GetProperty("version").GetUInt32() })
        }, token));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cancelled = await ReadJson<JsonElement>(response);
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
    }

    // ---------- العزل بين المستأجرين ----------

    [Fact]
    public async Task CrossTenant_SessionAccess_Returns404()
    {
        var clientA = NewClient();
        var tokenA = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);
        var quizA = await CreatePublishedQuizAsync(clientA, tokenA, tenantA, "sess-iso-a");
        var sessionA = await CreateSessionAsync(clientA, tokenA, tenantA, quizA);

        var clientB = NewClient();
        var tokenB = await RegisterConfirmLogin(_factory, clientB);
        var tenantB = await CreateTenantFor(clientB, tokenB);

        // المستأجر B يحاول قراءة جلسة المستأجر A عبر مساره الخاص ⇒ 404
        var readResponse = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantB}/quizzes/{quizA}/sessions/{sessionA}"), tokenB));
        Assert.Equal(HttpStatusCode.NotFound, readResponse.StatusCode);

        // ومحاولة إنشاء جلسة على اختبار المستأجر A ⇒ 404
        var createResponse = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantB}/quizzes/{quizA}/sessions")
        {
            Content = Json(new { mode = "SelfPaced" })
        }, tokenB));
        Assert.Equal(HttpStatusCode.NotFound, createResponse.StatusCode);
    }

    // ---------- اللاعب: الانضمام وأمان رمز الضيف ----------

    [Fact]
    public async Task Player_GetSession_ReturnsSafeMetadata_Only()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-meta-1");

        var response = await NewClient().GetAsync($"/api/v1/player/sessions/{joinCode}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var raw = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        Assert.Equal("اختبار الجلسات", root.GetProperty("title").GetString());
        Assert.Equal(2, root.GetProperty("questionCount").GetInt32());
        Assert.Equal(10, root.GetProperty("totalPoints").GetInt32());
        Assert.Equal("Active", root.GetProperty("status").GetString());
        Assert.True(root.GetProperty("canJoin").GetBoolean());

        // لا تسريب لأي بيانات تقييم أو أسئلة في metadata
        Assert.DoesNotContain("isCorrect", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("acceptedAnswers", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("options", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Player_Join_SetsGuestCookie_AndRejoin_IsIdempotent()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-join-1");

        var player = NewClient();
        var (firstJoin, guestToken) = await JoinAsync(player, joinCode, "طالب مجتهد");
        var participantId = firstJoin.GetProperty("participantId").GetGuid();
        Assert.Equal("طالب مجتهد", firstJoin.GetProperty("displayName").GetString());

        // إعادة الانضمام بنفس الكوكي تعيد نفس المشارك — بدون كوكي جديد
        var rejoinRequest = PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/join", guestToken, new { displayName = "طالب مجتهد" });
        var rejoinResponse = await player.SendAsync(rejoinRequest);
        Assert.Equal(HttpStatusCode.OK, rejoinResponse.StatusCode);
        var rejoin = await ReadJson<JsonElement>(rejoinResponse);
        Assert.Equal(participantId, rejoin.GetProperty("participantId").GetGuid());
        Assert.False(rejoinResponse.Headers.TryGetValues("Set-Cookie", out var cookies)
            && cookies.Any(v => v.StartsWith($"{GuestCookieName}=", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Player_AttemptEndpoints_WithoutCookie_Return401()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-auth-1");

        var anonymous = NewClient();
        var startResponse = await anonymous.PostAsync($"/api/v1/player/sessions/{joinCode}/attempts", null);
        Assert.Equal(HttpStatusCode.Unauthorized, startResponse.StatusCode);

        var questionResponse = await anonymous.GetAsync(
            $"/api/v1/player/sessions/{joinCode}/attempts/{Guid.NewGuid()}/current-question");
        Assert.Equal(HttpStatusCode.Unauthorized, questionResponse.StatusCode);
    }

    [Fact]
    public async Task Player_AttemptEndpoints_WithTamperedCookie_Return401()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-auth-2");

        var tampered = Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + Guid.NewGuid().ToString("N");
        var response = await NewClient().SendAsync(PlayerRequest(
            HttpMethod.Post, $"/api/v1/player/sessions/{joinCode}/attempts", tampered));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------- اللاعب: اللعب والتقييم ----------

    [Fact]
    public async Task Player_FullFlow_AnswerBothCorrect_ScoresFull_AndPasses()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (quizId, sessionId, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-play-1");

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب أول");

        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();
        Assert.Equal(2, start.GetProperty("totalQuestions").GetInt32());
        Assert.Equal(0, start.GetProperty("currentQuestionIndex").GetInt32());
        Assert.Equal("InProgress", start.GetProperty("status").GetString());

        // أجب على السؤالين بالخيار الصحيح (الخيار الأول في بنك الأسئلة — لكننا نقرأ الخيارات من الـDTO)
        for (var i = 0; i < 2; i++)
        {
            var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
            Assert.Equal(i, question.GetProperty("index").GetInt32());
            Assert.Equal("MultipleChoice", question.GetProperty("questionType").GetString());
            Assert.Equal(5, question.GetProperty("points").GetInt32());

            var itemId = question.GetProperty("quizVersionItemId").GetGuid();
            var optionId = question.GetProperty("options")[0].GetProperty("optionId").GetGuid();

            var answerResponse = await player.SendAsync(PlayerRequest(HttpMethod.Post,
                $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
                new { quizVersionItemId = itemId, answerJson = $$"""{"optionId":"{{optionId}}"}""" }));
            Assert.Equal(HttpStatusCode.OK, answerResponse.StatusCode);
            var answer = await ReadJson<JsonElement>(answerResponse);
            Assert.True(answer.GetProperty("isCorrect").GetBoolean());
            Assert.Equal(5m, answer.GetProperty("scoreAwarded").GetDecimal());
        }

        var finishResponse = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish", guestToken));
        Assert.Equal(HttpStatusCode.OK, finishResponse.StatusCode);
        var finish = await ReadJson<JsonElement>(finishResponse);
        Assert.Equal("Finished", finish.GetProperty("status").GetString());
        Assert.Equal(10m, finish.GetProperty("score").GetDecimal());
        Assert.Equal(10m, finish.GetProperty("maxScore").GetDecimal());
        Assert.Equal(100m, finish.GetProperty("percentage").GetDecimal());
        Assert.True(finish.GetProperty("passed").GetBoolean());

        // النتيجة متاحة لصاحب رمز الضيف
        var resultResponse = await player.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/result", guestToken));
        Assert.Equal(HttpStatusCode.OK, resultResponse.StatusCode);
        var result = await ReadJson<JsonElement>(resultResponse);
        Assert.Equal("لاعب أول", result.GetProperty("displayName").GetString());
        Assert.Equal(2, result.GetProperty("answeredCount").GetInt32());

        // المعلم يرى المشارك ودرجته في تفاصيل الجلسة
        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        var participant = session.GetProperty("participants").EnumerateArray().Single();
        Assert.Equal("لاعب أول", participant.GetProperty("displayName").GetString());
        Assert.Equal("Finished", participant.GetProperty("attemptStatus").GetString());
        Assert.Equal(10m, participant.GetProperty("score").GetDecimal());
        Assert.True(participant.GetProperty("passed").GetBoolean());
    }

    [Fact]
    public async Task Player_QuestionDto_NeverLeaksCorrectness()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-safe-1");

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب فضولي");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();

        var response = await player.SendAsync(PlayerRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question", guestToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("isCorrect", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("acceptedAnswers", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("correctOption", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Player_SubmitSameAnswerTwice_IsIdempotent_DifferentAnswer_Returns409()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-idem-1");

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب مكرر");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();

        var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
        var itemId = question.GetProperty("quizVersionItemId").GetGuid();
        var firstOption = question.GetProperty("options")[0].GetProperty("optionId").GetGuid();
        var secondOption = question.GetProperty("options")[1].GetProperty("optionId").GetGuid();
        var answerJson = $$"""{"optionId":"{{firstOption}}"}""";

        // التقديم الأول
        var first = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = itemId, answerJson }));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstPayload = await ReadJson<JsonElement>(first);

        // نفس الإجابة مرة ثانية ⇒ نفس النتيجة (Idempotent)
        var second = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = itemId, answerJson }));
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var secondPayload = await ReadJson<JsonElement>(second);
        Assert.Equal(firstPayload.GetProperty("revision").GetInt32(), secondPayload.GetProperty("revision").GetInt32());
        Assert.Equal(firstPayload.GetProperty("isCorrect").GetBoolean(), secondPayload.GetProperty("isCorrect").GetBoolean());

        // إجابة مختلفة لنفس السؤال ⇒ 409
        var conflict = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = itemId, answerJson = $$"""{"optionId":"{{secondOption}}"}""" }));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task Player_Finish_IsIdempotent()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-fin-1");

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب منهي");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();

        var first = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish", guestToken));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstPayload = await ReadJson<JsonElement>(first);
        Assert.Equal("Finished", firstPayload.GetProperty("status").GetString());

        // إنهاء ثانٍ يعيد نفس النتيجة
        var second = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish", guestToken));
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var secondPayload = await ReadJson<JsonElement>(second);
        Assert.Equal(firstPayload.GetProperty("score").GetDecimal(), secondPayload.GetProperty("score").GetDecimal());
        Assert.Equal("Finished", secondPayload.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Player_ResumeAfterRefresh_ReturnsCurrentQuestionIndex()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var (_, _, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "sess-resume-1");

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب مستأنف");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();

        // أجب على السؤال الأول
        var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
        var itemId = question.GetProperty("quizVersionItemId").GetGuid();
        var optionId = question.GetProperty("options")[0].GetProperty("optionId").GetGuid();
        await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = itemId, answerJson = $$"""{"optionId":"{{optionId}}"}""" }));

        // F5: إعادة الانضمام بنفس الكوكي تعيد المحاولة الجارية
        var (rejoin, _) = await JoinAsync(player, joinCode, "لاعب مستأنف", guestToken);
        Assert.Equal(attemptId, rejoin.GetProperty("attemptId").GetGuid());
        Assert.Equal("InProgress", rejoin.GetProperty("attemptStatus").GetString());

        // بدء المحاولة مرة أخرى يستأنف عند السؤال التالي
        var resumed = await StartAttemptAsync(player, joinCode, guestToken);
        Assert.Equal(attemptId, resumed.GetProperty("attemptId").GetGuid());
        Assert.Equal(1, resumed.GetProperty("currentQuestionIndex").GetInt32());

        // السؤال الأول يظهر كمجاب عليه عند طلبه مباشرة
        var firstQuestion = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
        Assert.Equal(1, firstQuestion.GetProperty("index").GetInt32());
    }

    [Fact]
    public async Task Player_Join_ScheduledSession_Returns409()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreatePublishedQuizAsync(client, token, tenantId, "sess-sched-1");
        var sessionId = await CreateSessionAsync(client, token, tenantId, quizId);
        var session = await GetSessionAsync(client, token, tenantId, quizId, sessionId);
        var joinCode = session.GetProperty("joinCode").GetString()!;

        // الجلسة Scheduled — canJoin=false والانضمام مرفوض
        var infoResponse = await NewClient().GetAsync($"/api/v1/player/sessions/{joinCode}");
        var info = await ReadJson<JsonElement>(infoResponse);
        Assert.False(info.GetProperty("canJoin").GetBoolean());

        var joinResponse = await NewClient().PostAsync(
            $"/api/v1/player/sessions/{joinCode}/join", Json(new { displayName = "مبكر جدًا" }));
        Assert.Equal(HttpStatusCode.Conflict, joinResponse.StatusCode);
    }

    [Fact]
    public async Task Player_UnknownJoinCode_Returns404()
    {
        var response = await NewClient().GetAsync("/api/v1/player/sessions/NO-SUCH-CODE");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
