using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// Phase 4.1 — إثبات عقد كوكي الضيف في المتصفح الفعلي على مستوى الـHeader:
/// - Dev/Testing (UseSecureCookie=false): اسم `tp-guest`، HttpOnly، Path=/, Expires، بلا Secure.
/// - Production (UseSecureCookie=true): اسم `__Host-tp-guest` مع Secure إلزامي.
/// - الاستعادة عبر `GET /me` من الكوكي فقط (بدون localStorage) وحذف الكوكي العالق عند رمز منتهي.
/// الـRaw Header هو ما سيتعامل معه المتصفح فعليًا (يُفرض الـ__Host-prefix من المتصفح).
/// </summary>
[Trait("Category", "Integration")]
public class GuestCookieTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private const string DevCookieName = "tp-guest";
    private const string SecureCookieName = "__Host-tp-guest";

    public GuestCookieTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    /// <summary>Factory يحاكي Production: UseSecureCookie=true يفعّل اسم __Host- وSecure.</summary>
    private sealed class SecureCookieFactory : TestWebApplicationFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Auth:UseSecureCookie"] = "true"
                });
            });
        }
    }

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

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

    /// <summary>ينشئ مستأجرًا واختبارًا MC منشورًا وجلسة مفعّلة، ويعيد joinCode.</summary>
    private static async Task<string> CreateActiveSessionJoinCodeAsync(
        TestWebApplicationFactory factory, HttpClient client)
    {
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Cookie Test User"
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
        var login = await ReadJson<JsonElement>(loginResponse);
        var accessToken = login.GetProperty("accessToken").GetString()!;

        var tenantResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
        {
            Content = Json(new
            {
                name = "Cookie Space",
                slug = $"ck-{Guid.NewGuid():N}"[..20],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            })
        }, accessToken));
        var tenant = await ReadJson<JsonElement>(tenantResponse);
        var tenantId = tenant.GetProperty("id").GetGuid();

        var bankResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks")
        {
            Content = Json(new { name = "Cookie Bank" })
        }, accessToken));
        var bank = await ReadJson<JsonElement>(bankResponse);
        var bankId = bank.GetProperty("id").GetGuid();

        var questionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "اختر",
                options = new object[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } }
            })
        }, accessToken));
        var question = await ReadJson<JsonElement>(questionResponse);
        var questionId = question.GetProperty("id").GetGuid();

        var quizResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "اختبار الكوكي", slug = $"cookie-{Guid.NewGuid():N}"[..20], description = "وصف" })
        }, accessToken));
        var quiz = await ReadJson<JsonElement>(quizResponse);
        var quizId = quiz.GetProperty("id").GetGuid();

        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points = 5, isRequired = true })
        }, accessToken));

        var draftResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft"), accessToken));
        var baseVersion = (await ReadJson<JsonElement>(draftResponse)).GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        var sessionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions")
        {
            Content = Json(new { mode = "SelfPaced" })
        }, accessToken));
        var session = await ReadJson<JsonElement>(sessionResponse);
        var sessionId = session.GetProperty("id").GetGuid();
        var joinCode = session.GetProperty("joinCode").GetString()!;

        var activateResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate")
        {
            Content = Json(new { baseVersion = session.GetProperty("version").GetUInt32() })
        }, accessToken));
        Assert.Equal(HttpStatusCode.OK, activateResponse.StatusCode);

        return joinCode;
    }

    [Fact]
    public async Task Join_SetsDevGuestCookie_HttpOnly_PathRoot_Expires_NoSecure()
    {
        var client = NewClient();
        var joinCode = await CreateActiveSessionJoinCodeAsync(_factory, client);

        var joinResponse = await client.PostAsync($"/api/v1/player/sessions/{joinCode}/join",
            Json(new { displayName = "طالب كوكي" }));
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var cookie = joinResponse.Headers.GetValues("Set-Cookie")
            .First(c => c.StartsWith($"{DevCookieName}=", StringComparison.OrdinalIgnoreCase));

        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("__Host-", cookie, StringComparison.OrdinalIgnoreCase);

        // بيئة Dev لا تُرسل Secure — والباقي بعد الاسم لا يحمل secure
        Assert.DoesNotContain("secure", cookie.Split(';').Skip(1).Aggregate(string.Empty, (a, p) => a + p),
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Join_WithSecureCookieConfig_UsesHostPrefix_AndSecure()
    {
        await using var secureFactory = new SecureCookieFactory();
        await secureFactory.EnsureDatabaseCreatedAsync();
        var client = secureFactory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

        var joinCode = await CreateActiveSessionJoinCodeAsync(secureFactory, client);

        var joinResponse = await client.PostAsync($"/api/v1/player/sessions/{joinCode}/join",
            Json(new { displayName = "طالب إنتاج" }));
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var cookie = joinResponse.Headers.GetValues("Set-Cookie")
            .First(c => c.StartsWith($"{SecureCookieName}=", StringComparison.OrdinalIgnoreCase));

        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetCurrentPlayer_WithValidCookie_ReturnsStoredName_AndSameParticipant()
    {
        var client = NewClient();
        var joinCode = await CreateActiveSessionJoinCodeAsync(_factory, client);

        var (participantId, cookieValue) = await JoinAndCaptureAsync(client, joinCode, "لاعب مستأنف");

        var meResponse = await client.SendAsync(GetMeRequest(joinCode, cookieValue));
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var me = await ReadJson<JsonElement>(meResponse);
        Assert.Equal("لاعب مستأنف", me.GetProperty("displayName").GetString());
        Assert.Equal(participantId, me.GetProperty("participantId").GetGuid());
        Assert.Equal(JsonValueKind.Null, me.GetProperty("attemptId").ValueKind);
    }

    [Fact]
    public async Task GetCurrentPlayer_WithStaleCookie_Returns401_AndDeletesCookie()
    {
        var client = NewClient();
        var joinCode = await CreateActiveSessionJoinCodeAsync(_factory, client);

        var staleValue = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var response = await client.SendAsync(GetMeRequest(joinCode, staleValue));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var deleteCookie = Assert.Single(
            response.Headers.GetValues("Set-Cookie"),
            c => c.StartsWith($"{DevCookieName}=", StringComparison.OrdinalIgnoreCase));
        Assert.StartsWith($"{DevCookieName}=;", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secure", deleteCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetCurrentPlayer_WithStaleCookie_DeletesHostPrefixedSecureCookie_Production()
    {
        await using var secureFactory = new SecureCookieFactory();
        await secureFactory.EnsureDatabaseCreatedAsync();
        var client = secureFactory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

        var joinCode = await CreateActiveSessionJoinCodeAsync(secureFactory, client);

        var staleValue = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var response = await client.SendAsync(GetMeRequest(joinCode, staleValue, SecureCookieName));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var deleteCookie = Assert.Single(
            response.Headers.GetValues("Set-Cookie"),
            c => c.StartsWith($"{SecureCookieName}=", StringComparison.OrdinalIgnoreCase));
        Assert.StartsWith($"{SecureCookieName}=;", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", deleteCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", deleteCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetCurrentPlayer_AfterStartingAttempt_ReturnsAttemptIdAndStatus()
    {
        var client = NewClient();
        var joinCode = await CreateActiveSessionJoinCodeAsync(_factory, client);

        var (_, cookieValue) = await JoinAndCaptureAsync(client, joinCode, "لاعب جارٍ");

        var startRequest = new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts");
        startRequest.Headers.TryAddWithoutValidation("Cookie", $"{DevCookieName}={cookieValue}");
        var startResponse = await client.SendAsync(startRequest);
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);
        var start = await ReadJson<JsonElement>(startResponse);
        var attemptId = start.GetProperty("attemptId").GetGuid();

        var meResponse = await client.SendAsync(GetMeRequest(joinCode, cookieValue));
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var me = await ReadJson<JsonElement>(meResponse);
        Assert.Equal(attemptId, me.GetProperty("attemptId").GetGuid());
        Assert.Equal("InProgress", me.GetProperty("attemptStatus").GetString());
    }

    // ---------- helpers ----------

    private static HttpRequestMessage GetMeRequest(string joinCode, string cookieValue, string cookieName)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/player/sessions/{joinCode}/me");
        request.Headers.TryAddWithoutValidation("Cookie", $"{cookieName}={cookieValue}");
        return request;
    }

    private static HttpRequestMessage GetMeRequest(string joinCode, string cookieValue) =>
        GetMeRequest(joinCode, cookieValue, DevCookieName);

    private static async Task<(Guid ParticipantId, string CookieValue)> JoinAndCaptureAsync(
        HttpClient client, string joinCode, string displayName)
    {
        var response = await client.PostAsync($"/api/v1/player/sessions/{joinCode}/join",
            Json(new { displayName }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await ReadJson<JsonElement>(response);
        var participantId = payload.GetProperty("participantId").GetGuid();

        var cookie = response.Headers.GetValues("Set-Cookie").First(v => v.StartsWith($"{DevCookieName}="));
        var cookieValue = cookie.Split(';')[0].Split('=')[1];
        return (participantId, cookieValue);
    }
}