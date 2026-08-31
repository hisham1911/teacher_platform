using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// Proves that reviewed file imports cross the HTTP/API/service/EF boundary atomically.
/// A failure after earlier rows have been created must roll the whole operation back.
/// </summary>
[Trait("Category", "Integration")]
public sealed class BulkQuestionImportFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public BulkQuestionImportFlowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    [Fact]
    public async Task BulkImport_AttachesAllRows_AndRollsBackEveryWriteWhenALaterRowFails()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Atomic import");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId);

        var successResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/bulk",
            token,
            new
            {
                quizId,
                questions = new[]
                {
                    MultipleChoice(bankId, "Atomic question one"),
                    MultipleChoice(bankId, "Atomic question two")
                }
            }));

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var success = await ReadJsonAsync<JsonElement>(successResponse);
        Assert.Equal(2, success.GetProperty("createdCount").GetInt32());
        Assert.Equal(2, success.GetProperty("questionIds").GetArrayLength());

        Assert.Equal(2, await QuestionCountAsync(client, token, tenantId));
        Assert.Equal(2, await DraftItemCountAsync(client, token, tenantId, quizId));

        // Row 1 is valid and is persisted by the inner service before row 2 is evaluated.
        // Row 2 references a non-existent bank, forcing a server-side failure after row 1.
        // The outer transaction must remove both row 1's question AND its quiz item.
        var failureResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/bulk",
            token,
            new
            {
                quizId,
                questions = new[]
                {
                    MultipleChoice(bankId, "Must be rolled back"),
                    MultipleChoice(Guid.NewGuid(), "Invalid bank forces rollback")
                }
            }));

        Assert.Equal(HttpStatusCode.NotFound, failureResponse.StatusCode);
        Assert.Equal(2, await QuestionCountAsync(client, token, tenantId));
        Assert.Equal(2, await DraftItemCountAsync(client, token, tenantId, quizId));
    }

    [Fact]
    public async Task BulkImport_CannotTargetAnotherTenantActivity_AndDoesNotCreateQuestions()
    {
        var clientA = NewClient();
        var tokenA = await RegisterConfirmLoginAsync(clientA);
        var tenantA = await CreateTenantAsync(clientA, tokenA, "Import A");
        var bankA = await CreateBankAsync(clientA, tokenA, tenantA);

        var clientB = NewClient();
        var tokenB = await RegisterConfirmLoginAsync(clientB);
        var tenantB = await CreateTenantAsync(clientB, tokenB, "Import B");
        var quizB = await CreateQuizAsync(clientB, tokenB, tenantB);

        var response = await clientA.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/questions/bulk",
            tokenA,
            new
            {
                quizId = quizB,
                questions = new[] { MultipleChoice(bankA, "Cross tenant should never persist") }
            }));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, await QuestionCountAsync(clientA, tokenA, tenantA));
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"bulk-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Bulk Import Teacher"
        }));
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(
            email,
            TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var confirm = await client.PostAsync("/api/v1/auth/confirm-email", Json(new
        {
            uid = query["uid"],
            token = query["token"]
        }));
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var login = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token, string name)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, "/api/v1/tenants", token, new
        {
            name,
            slug = $"bulk-{Guid.NewGuid():N}"[..22],
            countryCode = "EG",
            timezone = "Africa/Cairo",
            defaultLocale = "ar"
        }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankAsync(HttpClient client, string token, Guid tenantId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks",
            token,
            new { name = "Bulk Bank" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateQuizAsync(HttpClient client, string token, Guid tenantId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes",
            token,
            new
            {
                title = "Bulk activity",
                slug = $"bulk-activity-{Guid.NewGuid():N}"[..42],
                description = "Atomic import target"
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static object MultipleChoice(Guid bankId, string prompt) => new
    {
        bankId,
        questionType = "MultipleChoice",
        prompt,
        explanation = (string?)null,
        difficulty = "Medium",
        language = "en",
        tags = Array.Empty<string>(),
        options = new object[]
        {
            new { text = "Correct", isCorrect = true },
            new { text = "Wrong", isCorrect = false }
        },
        acceptedAnswers = (string[]?)null
    };

    private static async Task<int> QuestionCountAsync(HttpClient client, string token, Guid tenantId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?page=1&pageSize=100",
            token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("totalItems").GetInt32();
    }

    private static async Task<int> DraftItemCountAsync(HttpClient client, string token, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft",
            token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("items").GetArrayLength();
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string url, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        if (body is not null)
        {
            request.Content = Json(body);
        }
        return request;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }
}
