using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// Ø§Ø®ØªØ¨Ø§Ø±Ø§Øª Register â†’ Confirm Email â†’ Login â†’ Refresh â†’ Logout.
/// ØªØªØ·Ù„Ø¨ PostgreSQL Ø­Ù‚ÙŠÙ‚ÙŠÙ‹Ø§ Ø¹Ø¨Ø± INTEGRATION_TEST_DB.
/// </summary>
[Trait("Category", "Integration")]
public class AuthFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public AuthFlowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.EmailSender.Clear();
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    /// <summary>HttpClient Ø¨Ù„Ø§ Cookie Store ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø­ØªÙ‰ Ð½ÐµÐ»ÑŒÐ·Ñ ØªØ¬Ø§ÙˆØ² ØªØ³Ù„Ø³Ù„ Refresh ÙŠØ¯ÙˆÙŠÙ‹Ø§ ÙÙŠ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±.</summary>
    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static string NewEmail() => $"user-{Guid.NewGuid():N}@example.test";

    [Fact]
    public async Task Register_CreatesUser_AndProfile_AndSendsConfirmationEmail()
    {
        var client = NewClient();
        var email = NewEmail();

        var response = await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation);
        Assert.NotNull(confirmUrl);
        Assert.Contains("/auth/confirm-email", confirmUrl);
    }

    [Fact]
    public async Task ConfirmEmail_ValidToken_ConfirmsEmail()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;

        var confirmResponse = await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
    }

    [Fact]
    public async Task Login_UnconfirmedEmail_Returns403()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        Assert.Equal(HttpStatusCode.Forbidden, loginResponse.StatusCode);
    }

    [Fact]
    public async Task Login_ConfirmedEmail_ReturnsAccessToken_AndRefreshCookie()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        // Confirm via link
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.True(loginResponse.Headers.TryGetValues("Set-Cookie", out var cookies));
        // يجب أن تكون Refresh Cookie HttpOnly دائمًا (JavaScript لا يستطيع قراءتها)
        Assert.Contains(cookies, c =>
            c.Contains("__Host-tp-refresh", StringComparison.OrdinalIgnoreCase) &&
            c.Contains("HttpOnly", StringComparison.OrdinalIgnoreCase));

        var payload = await ReadJson<JsonElement>(loginResponse);
        Assert.True(payload.GetProperty("accessToken").GetString()!.Length > 0);
    }

    [Fact]
    public async Task Refresh_WithValidCookie_RotatesAndIssuesNewAccessToken()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var loginCookies = loginResponse.Headers.GetValues("Set-Cookie");
        var refreshCookie = loginCookies.First(c => c.Contains("__Host-tp-refresh"));
        var cookieValue = refreshCookie.Split(';')[0].Split('=', 2)[1];

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        request.Headers.Add("Cookie", $"__Host-tp-refresh={cookieValue}");
        var refreshResponse = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        Assert.True(refreshResponse.Headers.TryGetValues("Set-Cookie", out var newCookies));
        var newCookieValue = newCookies.First(c => c.Contains("__Host-tp-refresh")).Split(';')[0].Split('=', 2)[1];
        Assert.NotEqual(cookieValue, newCookieValue);
    }

    [Fact]
    public async Task Refresh_WithReusedOldToken_RevokesFamily()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        var oldCookie = cookies.First(c => c.Contains("__Host-tp-refresh")).Split(';')[0].Split('=', 2)[1];

        // First refresh â€” rotates
        var req1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req1.Headers.Add("Cookie", $"__Host-tp-refresh={oldCookie}");
        var res1 = await client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        // Reuse old token â€” should be rejected and family revoked
        var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req2.Headers.Add("Cookie", $"__Host-tp-refresh={oldCookie}");
        var res2 = await client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Unauthorized, res2.StatusCode);

        // New token should also fail (family revoked)
        var newCookies = res1.Headers.GetValues("Set-Cookie");
        var newCookie = newCookies.First(c => c.Contains("__Host-tp-refresh")).Split(';')[0].Split('=', 2)[1];
        var req3 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req3.Headers.Add("Cookie", $"__Host-tp-refresh={newCookie}");
        var res3 = await client.SendAsync(req3);
        Assert.Equal(HttpStatusCode.Unauthorized, res3.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesCurrentToken_AndClearsCookie()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        var refreshCookie = cookies.First(c => c.Contains("__Host-tp-refresh")).Split(';')[0].Split('=', 2)[1];

        var logoutReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logoutReq.Headers.Add("Cookie", $"__Host-tp-refresh={refreshCookie}");
        var logoutRes = await client.SendAsync(logoutReq);
        Assert.Equal(HttpStatusCode.OK, logoutRes.StatusCode);
        Assert.Contains("expires=", logoutRes.Headers.GetValues("Set-Cookie").First(), StringComparison.OrdinalIgnoreCase);

        // Old refresh should no longer work
        var refreshReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshReq.Headers.Add("Cookie", $"__Host-tp-refresh={refreshCookie}");
        var refreshRes = await client.SendAsync(refreshReq);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshRes.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401_AndDoesNotRevealUserExistence()
    {
        var client = NewClient();

        var response = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email = "nonexistent@example.test",
            password = "AnyPassword123!"
        }));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync(CancellationToken.None);
        // Should NOT reveal whether email exists
        Assert.DoesNotContain("nonexistent", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ForgotPassword_ExistingAndNonExistingEmail_Returns202_AndGenericMessage()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        _factory.EmailSender.Clear();

        var resExisting = await client.PostAsync("/api/v1/auth/forgot-password", Json(new { email }));
        var resNonExisting = await client.PostAsync("/api/v1/auth/forgot-password", Json(new { email = "missing@example.test" }));

        Assert.Equal(HttpStatusCode.Accepted, resExisting.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, resNonExisting.StatusCode);

        // Only existing gets an email
        Assert.NotNull(_factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.PasswordReset));
        Assert.Null(_factory.EmailSender.LastActionUrlFor("missing@example.test", TeacherPlatform.Application.Abstractions.EmailKind.PasswordReset));
    }

    [Fact]
    public async Task ResetPassword_ValidToken_ChangesPassword_AndRevokesRefreshTokens()
    {
        var client = NewClient();
        var email = NewEmail();

        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        var refreshCookie = cookies.First(c => c.Contains("__Host-tp-refresh")).Split(';')[0].Split('=', 2)[1];

        await client.PostAsync("/api/v1/auth/forgot-password", Json(new { email }));
        var resetUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.PasswordReset)!;
        var resetUri = new Uri(resetUrl);
        var resetToken = System.Web.HttpUtility.ParseQueryString(resetUri.Query)["token"]!;

        var resetResponse = await client.PostAsync("/api/v1/auth/reset-password", Json(new
        {
            uid,
            token = resetToken,
            newPassword = "NewPassword456!"
        }));
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);

        // Old refresh should be revoked
        var refreshReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshReq.Headers.Add("Cookie", $"__Host-tp-refresh={refreshCookie}");
        var refreshRes = await client.SendAsync(refreshReq);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshRes.StatusCode);

        // New password works
        var newLogin = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "NewPassword456!"
        }));
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    private static async Task<T> ReadJson<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }
}
