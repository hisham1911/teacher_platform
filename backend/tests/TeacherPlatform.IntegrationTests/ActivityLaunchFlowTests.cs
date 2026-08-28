using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class ActivityLaunchFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ActivityLaunchFlowTests(TestWebApplicationFactory factory) => _factory = factory;
    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;
    private HttpClient NewClient() => _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });
    private static StringContent Json(object payload) => new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    [Fact]
    public async Task SelfPacedLaunch_RetryWithSameRequestId_ReturnsExactlySameSession()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Launch retry");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "retry");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { MultipleChoice(bankId, "Retry-safe question") });
        var draftVersion = await DraftVersionAsync(client, token, tenantId, quizId);
        var requestId = Guid.NewGuid();

        var first = await LaunchAsync(client, token, tenantId, quizId, requestId, "SelfPaced", draftVersion);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstBody = await ReadJsonAsync<JsonElement>(first);
        Assert.Equal("Active", firstBody.GetProperty("status").GetString());

        var retry = await LaunchAsync(client, token, tenantId, quizId, requestId, "SelfPaced", draftVersion);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var retryBody = await ReadJsonAsync<JsonElement>(retry);
        Assert.Equal(firstBody.GetProperty("id").GetGuid(), retryBody.GetProperty("id").GetGuid());
        Assert.Equal(firstBody.GetProperty("joinCode").GetString(), retryBody.GetProperty("joinCode").GetString());
        Assert.Equal(1, await SessionCountAsync(client, token, tenantId, quizId));
    }

    [Fact]
    public async Task ProgressiveLaunch_WhenModeValidationFailsAfterPublish_RollsBackPublishAndSession()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Launch rollback");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "rollback");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { ShortAnswer(bankId, "Type a word") });
        var draftBefore = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("NeverPublished", draftBefore.GetProperty("publicationState").GetString());

        var response = await LaunchAsync(client, token, tenantId, quizId, Guid.NewGuid(), "ProgressiveChallenge", draftBefore.GetProperty("version").GetUInt32());
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var draftAfter = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("NeverPublished", draftAfter.GetProperty("publicationState").GetString());
        Assert.Equal(draftBefore.GetProperty("id").GetGuid(), draftAfter.GetProperty("id").GetGuid());
        Assert.Equal(0, await SessionCountAsync(client, token, tenantId, quizId));
    }

    [Fact]
    public async Task LiveActivation_RepeatingOriginalRequestAfterSuccess_IsIdempotent()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Live retry");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "live");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { MultipleChoice(bankId, "Live question") });
        var draftVersion = await DraftVersionAsync(client, token, tenantId, quizId);

        var launch = await LaunchAsync(client, token, tenantId, quizId, Guid.NewGuid(), "Live", draftVersion);
        Assert.Equal(HttpStatusCode.OK, launch.StatusCode);
        var scheduled = await ReadJsonAsync<JsonElement>(launch);
        Assert.Equal("Scheduled", scheduled.GetProperty("status").GetString());
        var sessionId = scheduled.GetProperty("id").GetGuid();
        var originalVersion = scheduled.GetProperty("version").GetUInt32();

        var activate = await StateChangeAsync(client, token, tenantId, quizId, sessionId, "activate", originalVersion);
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);
        Assert.Equal("Active", (await ReadJsonAsync<JsonElement>(activate)).GetProperty("status").GetString());

        var retry = await StateChangeAsync(client, token, tenantId, quizId, sessionId, "activate", originalVersion);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal("Active", (await ReadJsonAsync<JsonElement>(retry)).GetProperty("status").GetString());
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"launch-{Guid.NewGuid():N}@example.test";
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/register", Json(new { email, password = "SecurePassword123!", fullName = "Launch Teacher" }))).StatusCode);
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid = query["uid"], token = query["token"] }))).StatusCode);
        var login = await client.PostAsync("/api/v1/auth/login", Json(new { email, password = "SecurePassword123!" }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token, string name)
    {
        var slug = $"launch-{Guid.NewGuid():N}"[..24];
        var response = await client.SendAsync(Authorized(HttpMethod.Post, "/api/v1/tenants", token, new { name, slug, countryCode = "EG", timezone = "Africa/Cairo", defaultLocale = "ar" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankAsync(HttpClient client, string token, Guid tenantId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/question-banks", token, new { name = "Launch Bank" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateQuizAsync(HttpClient client, string token, Guid tenantId, string suffix)
    {
        var slug = $"launch-{suffix}-{Guid.NewGuid():N}";
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes", token, new { title = $"Launch {suffix}", slug, description = "launch test" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task AddQuestionsAsync(HttpClient client, string token, Guid tenantId, Guid quizId, object[] questions)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/questions/bulk", token, new { quizId, questions }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static object MultipleChoice(Guid bankId, string prompt) => new { bankId, questionType = "MultipleChoice", prompt, explanation = (string?)null, difficulty = "Medium", language = "en", tags = Array.Empty<string>(), options = new object[] { new { text = "Correct", isCorrect = true }, new { text = "Wrong", isCorrect = false } }, acceptedAnswers = (string[]?)null };
    private static object ShortAnswer(Guid bankId, string prompt) => new { bankId, questionType = "ShortAnswer", prompt, explanation = (string?)null, difficulty = "Medium", language = "en", tags = Array.Empty<string>(), options = Array.Empty<object>(), acceptedAnswers = new[] { "spark" } };

    private static async Task<uint> DraftVersionAsync(HttpClient client, string token, Guid tenantId, Guid quizId) => (await GetDraftAsync(client, token, tenantId, quizId)).GetProperty("version").GetUInt32();
    private static async Task<JsonElement> GetDraftAsync(HttpClient client, string token, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static Task<HttpResponseMessage> LaunchAsync(HttpClient client, string token, Guid tenantId, Guid quizId, Guid requestId, string mode, uint draftVersion) =>
        client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/launch", token, new { requestId, mode, label = "Launch", draftBaseVersion = draftVersion }));

    private static Task<HttpResponseMessage> StateChangeAsync(HttpClient client, string token, Guid tenantId, Guid quizId, Guid sessionId, string action, uint baseVersion) =>
        client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/{action}", token, new { baseVersion }));

    private static async Task<int> SessionCountAsync(HttpClient client, string token, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions?page=1&pageSize=100", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("totalItems").GetInt32();
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string url, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }
}
