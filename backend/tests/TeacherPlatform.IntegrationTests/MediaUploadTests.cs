using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات رفع الوسائط: Magic bytes تقبل JPG/PNG وترفض SVG/Binaries.
/// عزل المستأجر: رفع A لا يكشف لـB حتى لو عرف mediaId.
/// </summary>
[Trait("Category", "Integration")]
public class MediaUploadTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public MediaUploadTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<(string AccessToken, Guid TenantId)> CreateUserWithTenantAsync(
        TestWebApplicationFactory factory, HttpClient client)
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
        var tokenValue = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token = tokenValue }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        var payload = await ReadJson<JsonElement>(loginResponse);
        var accessToken = payload.GetProperty("accessToken").GetString()!;

        var tenantResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
        {
            Content = Json(new
            {
                name = "Media Space",
                slug = $"media-{Guid.NewGuid():N}"[..20],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            })
        }, accessToken));
        var tenant = await ReadJson<JsonElement>(tenantResponse);
        return (accessToken, tenant.GetProperty("id").GetGuid());
    }

    private static HttpRequestMessage WithAccessToken(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return request;
    }

    private static MultipartFormDataContent FileContent(byte[] bytes, string fileName, string mimeType)
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
        content.Add(file, "file", fileName);
        return content;
    }

    private static async Task<T> ReadJson<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }

    [Fact]
    public async Task Upload_ValidPngImage_Succeeds()
    {
        var client = NewClient();
        var (token, tenantId) = await CreateUserWithTenantAsync(_factory, client);

        var png = new byte[]
        {
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        };

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = FileContent(png, "photo.png", "image/png")
        }, token));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await ReadJson<JsonElement>(response);
        Assert.Equal("Image", dto.GetProperty("kind").GetString());
        Assert.Equal("image/png", dto.GetProperty("mimeType").GetString());
        Assert.True(dto.GetProperty("sizeBytes").GetInt64() == png.Length);
        Assert.StartsWith("/api/", dto.GetProperty("downloadUrl").GetString()!);
    }

    [Fact]
    public async Task Upload_SvgLikeFile_AsPng_FailsMagicBytes()
    {
        var client = NewClient();
        var (token, tenantId) = await CreateUserWithTenantAsync(_factory, client);

        var fakeSvg = Encoding.ASCII.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = FileContent(fakeSvg, "image.png", "image/png")
        }, token));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_Executable_AsJpeg_FailsMagicBytes()
    {
        var client = NewClient();
        var (token, tenantId) = await CreateUserWithTenantAsync(_factory, client);

        var exe = new byte[16];
        exe[0] = 0x4D; exe[1] = 0x5A; // MZ
        exe[2] = 0x90; exe[3] = 0x00;

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = FileContent(exe, "virus.jpg", "image/jpeg")
        }, token));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_TooLargeImage_Returns413()
    {
        var client = NewClient();
        var (token, tenantId) = await CreateUserWithTenantAsync(_factory, client);

        var big = new byte[2 * 1024 * 1024]; // 2MB — يتجاوز ImageMaxBytes = 1MB في appsettings.Testing
        big[0] = 0xFF; big[1] = 0xD8; big[2] = 0xFF;

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = FileContent(big, "photo.jpg", "image/jpeg")
        }, token));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task Media_UploadedByTenantA_NotAccessibleByTenantB()
    {
        var clientA = NewClient();
        var (tokenA, tenantA) = await CreateUserWithTenantAsync(_factory, clientA);

        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        var upload = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/media")
        {
            Content = FileContent(png, "secret.png", "image/png")
        }, tokenA));
        var dto = await ReadJson<JsonElement>(upload);
        var mediaId = dto.GetProperty("id").GetGuid();

        var clientB = NewClient();
        var (tokenB, tenantB) = await CreateUserWithTenantAsync(_factory, clientB);

        // B لا يستطيع حتى قراءة المحتوى رغم معرفة id (الـMiddleware يمنع عدم العضوية بـ404)
        var bAttempt = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/media/{mediaId}/content"), tokenB));
        Assert.True(bAttempt.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound or HttpStatusCode.Unauthorized);

        // A يعمل بشكل طبيعي
        var aRead = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/media/{mediaId}/content"), tokenA));
        Assert.Equal(HttpStatusCode.OK, aRead.StatusCode);
        Assert.Equal("image/png", aRead.Content.Headers.ContentType?.MediaType);
    }
}
