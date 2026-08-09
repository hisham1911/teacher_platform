using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.IntegrationTests.Infrastructure;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class TenantTransferTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TestWebApplicationFactory _factory;

    public TenantTransferTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Owner_CanDryRunAndImportPortableContent_WithoutCrossTenantAccess()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "transfer-owner");
        var sourceTenantId = await CreateTenantAsync(client, owner.Token, "Transfer source");
        var targetTenantId = await CreateTenantAsync(client, owner.Token, "Transfer target");

        var bank = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/question-banks",
            owner.Token,
            new { name = "Portable bank" });
        var bankId = bank.GetProperty("id").GetGuid();
        var question = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/questions",
            owner.Token,
            new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "Which answer is correct?",
                options = new[]
                {
                    new { text = "A", isCorrect = true },
                    new { text = "B", isCorrect = false }
                },
                tags = new[] { "portable" }
            });
        var questionId = question.GetProperty("id").GetGuid();

        var quiz = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/quizzes",
            owner.Token,
            new { title = "Portable quiz", slug = "portable-quiz" });
        var quizId = quiz.GetProperty("id").GetGuid();
        await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/quizzes/{quizId}/draft/items",
            owner.Token,
            new { questionId, points = 2, isRequired = true });

        await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/surveys",
            owner.Token,
            new
            {
                quizId,
                title = "Portable survey",
                questions = new[]
                {
                    new
                    {
                        questionType = "Rating",
                        prompt = "Rate this quiz",
                        isRequired = true,
                        options = Array.Empty<object>()
                    }
                }
            });
        await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/tenants/{sourceTenantId}/certificate-templates",
            owner.Token,
            new
            {
                name = "Portable certificate",
                titleText = "Certificate",
                bodyText = "Awarded for passing",
                issuerName = "Teacher",
                primaryColor = "#0F766E",
                secondaryColor = "#D97706",
                isDefault = true
            });

        var exportRequest = Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{sourceTenantId}/transfer/export",
            owner.Token);
        var exportResponse = await client.SendAsync(exportRequest);
        Assert.Equal(HttpStatusCode.OK, exportResponse.StatusCode);
        Assert.Equal("application/zip", exportResponse.Content.Headers.ContentType?.MediaType);
        var archiveBytes = await exportResponse.Content.ReadAsByteArrayAsync();
        Assert.NotEmpty(archiveBytes);

        var outsider = await RegisterConfirmLoginAsync(client, "transfer-outsider");
        var forbidden = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{sourceTenantId}/transfer/export",
            outsider.Token));
        Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);

        var dryRun = await ImportAsync(client, targetTenantId, owner.Token, archiveBytes, dryRun: true);
        Assert.Equal(HttpStatusCode.OK, dryRun.StatusCode);
        var dryRunPayload = await ReadJsonAsync<JsonElement>(dryRun);
        Assert.True(dryRunPayload.GetProperty("dryRun").GetBoolean());
        Assert.Equal(1, dryRunPayload.GetProperty("counts").GetProperty("questions").GetInt32());
        Assert.Equal(sourceTenantId, dryRunPayload.GetProperty("sourceTenantId").GetGuid());
        Assert.Equal(targetTenantId, dryRunPayload.GetProperty("targetTenantId").GetGuid());
        Assert.Empty((await GetArrayAsync(
            client, $"/api/v1/tenants/{targetTenantId}/question-banks", owner.Token)).EnumerateArray());

        var import = await ImportAsync(client, targetTenantId, owner.Token, archiveBytes, dryRun: false);
        Assert.Equal(HttpStatusCode.OK, import.StatusCode);

        var targetBanks = await GetArrayAsync(
            client, $"/api/v1/tenants/{targetTenantId}/question-banks", owner.Token);
        var targetQuizPage = await GetJsonAsync(
            client, $"/api/v1/tenants/{targetTenantId}/quizzes", owner.Token);
        var targetTemplates = await GetArrayAsync(
            client, $"/api/v1/tenants/{targetTenantId}/certificate-templates", owner.Token);
        Assert.Contains(targetBanks.EnumerateArray(), item => item.GetProperty("name").GetString() == "Portable bank");
        Assert.Contains(
            targetQuizPage.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("title").GetString() == "Portable quiz");
        Assert.Contains(targetTemplates.EnumerateArray(), item => item.GetProperty("name").GetString() == "Portable certificate");
    }

    [Fact]
    public async Task Import_RejectsMalformedArchive_WithoutWritingContent()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "invalid-transfer-owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Invalid transfer target");

        var response = await ImportAsync(
            client,
            tenantId,
            owner.Token,
            "not-a-zip-archive"u8.ToArray(),
            dryRun: false);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            "InvalidImport",
            (await ReadJsonAsync<JsonElement>(response)).GetProperty("title").GetString());
        Assert.Empty((await GetArrayAsync(
            client, $"/api/v1/tenants/{tenantId}/question-banks", owner.Token)).EnumerateArray());
    }

    private async Task<(string Token, string Email)> RegisterConfirmLoginAsync(HttpClient client, string prefix)
    {
        var email = $"{prefix}-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Transfer Owner"
        });
        register.EnsureSuccessStatusCode();
        var confirmation = new Uri(_factory.EmailSender.LastActionUrlFor(email, EmailKind.Confirmation)!);
        var query = System.Web.HttpUtility.ParseQueryString(confirmation.Query);
        var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm-email", new
        {
            uid = query["uid"],
            token = query["token"]
        });
        confirm.EnsureSuccessStatusCode();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "SecurePassword123!"
        });
        login.EnsureSuccessStatusCode();
        return ((await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!, email);
    }

    private static async Task<Guid> CreateTenantAsync(
        HttpClient client,
        string token,
        string name)
    {
        var response = await client.SendAsync(Request(
            HttpMethod.Post,
            "/api/v1/tenants",
            token,
            new
            {
                name,
                slug = $"transfer-{Guid.NewGuid():N}"[..30],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "en"
            }));
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        string token,
        object payload)
    {
        var response = await client.SendAsync(Request(method, path, token, payload));
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static async Task<JsonElement> GetArrayAsync(
        HttpClient client,
        string path,
        string token)
    {
        var response = await client.SendAsync(Request(HttpMethod.Get, path, token));
        response.EnsureSuccessStatusCode();
        var payload = await ReadJsonAsync<JsonElement>(response);
        Assert.Equal(JsonValueKind.Array, payload.ValueKind);
        return payload;
    }

    private static async Task<JsonElement> GetJsonAsync(
        HttpClient client,
        string path,
        string token)
    {
        var response = await client.SendAsync(Request(HttpMethod.Get, path, token));
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static Task<HttpResponseMessage> ImportAsync(
        HttpClient client,
        Guid tenantId,
        string token,
        byte[] archive,
        bool dryRun)
    {
        var request = Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/transfer/import?dryRun={dryRun.ToString().ToLowerInvariant()}",
            token);
        var multipart = new MultipartFormDataContent();
        var file = new ByteArrayContent(archive);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        multipart.Add(file, "archive", "tenant-export.zip");
        request.Content = multipart;
        return client.SendAsync(request);
    }

    private static HttpRequestMessage Request(
        HttpMethod method,
        string path,
        string token,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return request;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response) =>
        (await JsonSerializer.DeserializeAsync<T>(
            await response.Content.ReadAsStreamAsync(), JsonOptions))!;
}
