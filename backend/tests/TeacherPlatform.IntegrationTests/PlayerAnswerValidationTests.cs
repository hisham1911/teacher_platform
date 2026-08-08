using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات Phase 4.1: رفض حمولات الإجابات غير الصالحة عند طبقة الـAPI بـ 400
/// InvalidAnswerPayload قبل أي حفظ — خيارات أجنبية، بنية خاطئة، Ordering ناقص/مكرر/أجنبي.
/// تثبت أيضًا: لا تقدم بعد الرفض، الإجابة الصالحة (حتى الخاطئة) تُقبل، تكرار الإجابة Idempotent،
/// وتغيير إجابة مقبولة يعيد 409.
/// </summary>
[Trait("Category", "Integration")]
public class PlayerAnswerValidationTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private const string GuestCookieName = "tp-guest";

    public PlayerAnswerValidationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    // ---------- Auth/tenant/bank helpers ----------

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
                    name = "Answer Validation Space",
                    slug = $"av-{Guid.NewGuid():N}"[..20],
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
                Content = Json(new { name = "Validation Bank" })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> UploadAudioAsync(HttpClient client, string accessToken, Guid tenantId)
    {
        // MP3 sync bytes — تُرضي فحص Magic bytes في MediaFileValidator
        var mp3 = new byte[] { 0xFF, 0xFB, 0x90, 0x64 };
        var content = new MultipartFormDataContent();
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

    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug, Guid[] questionIds)
    {
        var createResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "اختبار التحقق من الإجابات", slug, description = "وصف" })
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
        var baseVersion = (await ReadJson<JsonElement>(draftResponse)).GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        return quizId;
    }

    private static async Task<(Guid QuizId, string JoinCode)> CreateActiveSessionAsync(
        HttpClient client, string accessToken, Guid tenantId, string slug, Guid[] questionIds)
    {
        var quizId = await CreatePublishedQuizAsync(client, accessToken, tenantId, slug, questionIds);

        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "SelfPaced", label = "حصة التحقق" })
        }, accessToken));
        Assert.Equal(HttpStatusCode.Created, sessionResponse.StatusCode);
        var session = await ReadJson<JsonElement>(sessionResponse);

        var activateResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{session.GetProperty("id").GetGuid()}/activate")
        {
            Content = Json(new { baseVersion = session.GetProperty("version").GetUInt32() })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, activateResponse.StatusCode);

        return (quizId, session.GetProperty("joinCode").GetString()!);
    }

    // ---------- Player helpers ----------

    private static async Task<(JsonElement Payload, string GuestToken)> JoinAsync(
        HttpClient client, string joinCode, string displayName)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/player/sessions/{joinCode}/join")
        {
            Content = Json(new { displayName })
        };

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJson<JsonElement>(response);

        var cookie = response.Headers.GetValues("Set-Cookie").Single(
            v => v.StartsWith($"{GuestCookieName}=", StringComparison.Ordinal));
        var token = cookie.Split(';')[0].Substring(GuestCookieName.Length + 1);
        return (payload, token);
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

    private static async Task<HttpResponseMessage> SubmitAnswerAsync(
        HttpClient client, string joinCode, Guid attemptId, string guestToken, Guid itemId, string answerJson)
    {
        return await client.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", guestToken,
            new { quizVersionItemId = itemId, answerJson }));
    }

    private static async Task<JsonElement> ReadProblemTitleAsync(HttpResponseMessage response)
    {
        var problem = await ReadJson<JsonElement>(response);
        return problem.GetProperty("title");
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

    private static Guid[] OptionsOf(JsonElement question)
    {
        return question.GetProperty("options").EnumerateArray()
            .Select(o => o.GetProperty("optionId").GetGuid())
            .ToArray();
    }

    // ---------- سيناريو شامل: 5 أنواع، رفض كل حمولة غير صالحة، لا تقدم بعد الرفض ----------

    [Fact]
    public async Task SubmitAnswer_InvalidPayloads_Rejected400_WithoutProgressOrSave()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var audioId = await UploadAudioAsync(client, token, tenantId);

        var mc = await CreateQuestionAsync(client, token, tenantId, bankId, "MultipleChoice", "اختر الإجابة",
            new object[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } });
        var tf = await CreateQuestionAsync(client, token, tenantId, bankId, "TrueFalse", "صواب أم خطأ",
            new object[] { new { text = "صواب", isCorrect = true }, new { text = "خطأ", isCorrect = false } });
        var listening = await CreateQuestionAsync(client, token, tenantId, bankId, "Listening", "استمع واختر",
            new object[] { new { text = "خيار 1", isCorrect = true }, new { text = "خيار 2", isCorrect = false } },
            mediaAssetId: audioId);
        var shortAnswer = await CreateQuestionAsync(client, token, tenantId, bankId, "ShortAnswer", "اكتب الجواب",
            Array.Empty<object>(), acceptedAnswers: new[] { "القاهرة" });
        var ordering = await CreateQuestionAsync(client, token, tenantId, bankId, "Ordering", "رتّب الترتيب",
            new object[] { new { text = "أولًا", isCorrect = false }, new { text = "ثانيًا", isCorrect = false } });

        var (_, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "val-flow-1",
            new[] { mc, tf, listening, shortAnswer, ordering });

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب تحقق");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();
        Assert.Equal(5, start.GetProperty("totalQuestions").GetInt32());

        // لكل سؤال: حمولة غير صالحة ⇒ 400 InvalidAnswerPayload، ثم لا تقدم، ثم صالحة ⇒ 200
        for (var index = 0; index < 5; index++)
        {
            var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
            Assert.Equal(index, question.GetProperty("index").GetInt32());

            var itemId = question.GetProperty("quizVersionItemId").GetGuid();
            var options = OptionsOf(question);
            var type = question.GetProperty("questionType").GetString();

            var invalidPayload = type switch
            {
                "MultipleChoice" or "Listening" => $$"""{"optionId":"{{Guid.NewGuid()}}"}""",
                "TrueFalse" => """{"text":"صواب"}""",
                "ShortAnswer" => $$"""{"optionId":"{{Guid.NewGuid()}}"}""",
                "Ordering" => $$"""{"orderedOptionIds":["{{options[0]}}"]}""", // ناقص
                _ => throw new InvalidOperationException($"Unexpected type {type}")
            };

            var rejected = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId, invalidPayload);
            Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
            Assert.Equal("InvalidAnswerPayload", (await ReadProblemTitleAsync(rejected)).GetString());

            // لا تقدم بعد الرفض — ما زلنا على نفس السؤال
            var afterReject = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
            Assert.Equal(index, afterReject.GetProperty("index").GetInt32());

            // إجابة صالحة (حتى لو خاطئة البنية الصواب) تُقبل وتُسجَّل
            var validPayload = type switch
            {
                "MultipleChoice" or "TrueFalse" or "Listening" => $$"""{"optionId":"{{options[0]}}"}""",
                "ShortAnswer" => """{"text":"إجابة"}""",
                "Ordering" => $$"""{"orderedOptionIds":["{{options[0]}}","{{options[1]}}"]}""",
                _ => throw new InvalidOperationException($"Unexpected type {type}")
            };

            var accepted = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId, validPayload);
            Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
            var acceptedBody = await ReadJson<JsonElement>(accepted);

            // تكرار نفس الإجابة ⇒ Idempotent بنفس Revision
            var repeated = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId, validPayload);
            Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
            var repeatedBody = await ReadJson<JsonElement>(repeated);
            Assert.Equal(acceptedBody.GetProperty("revision").GetInt32(), repeatedBody.GetProperty("revision").GetInt32());
            Assert.Equal(acceptedBody.GetProperty("isCorrect").GetBoolean(), repeatedBody.GetProperty("isCorrect").GetBoolean());

            // تغيير الإجابة إلى إجابة صالحة أخرى ⇒ 409 AnswerConflict
            var changedPayload = type switch
            {
                "MultipleChoice" or "TrueFalse" or "Listening" => $$"""{"optionId":"{{options[1]}}"}""",
                "ShortAnswer" => """{"text":"إجابة أخرى"}""",
                "Ordering" => $$"""{"orderedOptionIds":["{{options[1]}}","{{options[0]}}"]}""",
                _ => throw new InvalidOperationException($"Unexpected type {type}")
            };
            var conflict = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId, changedPayload);
            Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        }

        // كل الأسئلة أُجيب — السؤال التالي قد انتهى فالمحاولة كاملة
        var finishResponse = await player.SendAsync(PlayerRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish", guestToken));
        Assert.Equal(HttpStatusCode.OK, finishResponse.StatusCode);
    }

    // ---------- Ordering: حالات رفض متفرقة ----------

    [Fact]
    public async Task SubmitAnswer_Ordering_DuplicateAndForeign_Return400()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var ordering = await CreateQuestionAsync(client, token, tenantId, bankId, "Ordering", "رتّب",
            new object[] { new { text = "أ", isCorrect = false }, new { text = "ب", isCorrect = false } });

        var (_, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "val-ord-1", new[] { ordering });

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب ترتيب");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();
        var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
        var itemId = question.GetProperty("quizVersionItemId").GetGuid();
        var options = OptionsOf(question);

        var duplicate = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId,
            $$"""{"orderedOptionIds":["{{options[0]}}","{{options[0]}}"]}""");
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Equal("InvalidAnswerPayload", (await ReadProblemTitleAsync(duplicate)).GetString());

        var foreign = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId,
            $$"""{"orderedOptionIds":["{{options[0]}}","{{Guid.NewGuid()}}"]}""");
        Assert.Equal(HttpStatusCode.BadRequest, foreign.StatusCode);
        Assert.Equal("InvalidAnswerPayload", (await ReadProblemTitleAsync(foreign)).GetString());

        // ما زلنا على نفس السؤال ولم يُسجَّل شيء — إجابة كاملة صحيحة تعمل الآن
        var valid = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId,
            $$"""{"orderedOptionIds":["{{options[0]}}","{{options[1]}}"]}""");
        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
        var validBody = await ReadJson<JsonElement>(valid);
        Assert.True(validBody.GetProperty("isCorrect").GetBoolean());
        Assert.Equal(5m, validBody.GetProperty("scoreAwarded").GetDecimal());
    }

    // ---------- إجابة خاطئة صحيحة البنية تُسجَّل بصفر ولا تُرفض ----------

    [Fact]
    public async Task SubmitAnswer_WrongButValid_IsAccepted_AndScoresZero()
    {
        var client = NewClient();
        var token = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var mc = await CreateQuestionAsync(client, token, tenantId, bankId, "MultipleChoice", "اختر الصحيح",
            new object[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } });

        var (_, joinCode) = await CreateActiveSessionAsync(client, token, tenantId, "val-wrong-1", new[] { mc });

        var player = NewClient();
        var (_, guestToken) = await JoinAsync(player, joinCode, "لاعب مخطئ");
        var start = await StartAttemptAsync(player, joinCode, guestToken);
        var attemptId = start.GetProperty("attemptId").GetGuid();
        var question = await GetCurrentQuestionAsync(player, joinCode, attemptId, guestToken);
        var itemId = question.GetProperty("quizVersionItemId").GetGuid();
        var options = OptionsOf(question);

        // الخيار الثاني صحيح البنية لكنه خاطئ ⇒ 200 مع صفر
        var wrong = await SubmitAnswerAsync(player, joinCode, attemptId, guestToken, itemId,
            $$"""{"optionId":"{{options[1]}}"}""");
        Assert.Equal(HttpStatusCode.OK, wrong.StatusCode);
        var wrongBody = await ReadJson<JsonElement>(wrong);
        Assert.False(wrongBody.GetProperty("isCorrect").GetBoolean());
        Assert.Equal(0m, wrongBody.GetProperty("scoreAwarded").GetDecimal());
    }
}
