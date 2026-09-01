using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class StudentPortalFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private const string PortalCookie = "tp-student";
    private const string GuestCookie = "tp-guest";
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public StudentPortalFlowTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    [Fact]
    public async Task AccessCode_LoginHomeLogout_DoesNotPersistRawCredentialInTeacherReads()
    {
        var teacher = NewClient();
        var token = await RegisterConfirmLoginAsync(teacher);
        var tenantId = await CreateTenantAsync(teacher, token, "Portal workspace");
        var student = await CreateStudentAsync(teacher, token, tenantId, "هشام محمد");
        var studentId = student.GetProperty("id").GetGuid();

        var emptyStatus = await teacher.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access",
            token));
        Assert.Equal(HttpStatusCode.OK, emptyStatus.StatusCode);
        Assert.False((await ReadJsonAsync<JsonElement>(emptyStatus)).GetProperty("hasAccessCode").GetBoolean());

        var createAccess = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access",
            token));
        Assert.Equal(HttpStatusCode.OK, createAccess.StatusCode);
        var createdAccess = await ReadJsonAsync<JsonElement>(createAccess);
        var accessCode = createdAccess.GetProperty("accessCode").GetString()!;
        Assert.Contains('-', accessCode);
        Assert.Equal(19, accessCode.Length); // 16 symbols + 3 separators

        var statusResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access",
            token));
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var statusText = await statusResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(accessCode, statusText, StringComparison.Ordinal);
        var status = JsonSerializer.Deserialize<JsonElement>(statusText, JsonOptions);
        Assert.True(status.GetProperty("hasAccessCode").GetBoolean());
        Assert.Equal(createdAccess.GetProperty("codeSuffix").GetString(), status.GetProperty("codeSuffix").GetString());

        var anonymous = NewClient();
        var badLogin = await anonymous.PostAsync("/api/v1/student-portal/login", Json(new { accessCode = "WRONG-CODE-1234" }));
        Assert.Equal(HttpStatusCode.Unauthorized, badLogin.StatusCode);

        var login = await anonymous.PostAsync("/api/v1/student-portal/login", Json(new { accessCode }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var portalToken = ReadCookie(login, PortalCookie);
        Assert.False(string.IsNullOrWhiteSpace(portalToken));
        Assert.Contains("httponly", GetSetCookie(login), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", GetSetCookie(login), StringComparison.OrdinalIgnoreCase);

        var me = await anonymous.SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/me", PortalCookie, portalToken));
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var profile = await ReadJsonAsync<JsonElement>(me);
        Assert.Equal(studentId, profile.GetProperty("studentId").GetGuid());
        Assert.Equal("هشام محمد", profile.GetProperty("fullName").GetString());
        Assert.Equal("Portal workspace", profile.GetProperty("workspaceName").GetString());

        var home = await anonymous.SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/home", PortalCookie, portalToken));
        Assert.Equal(HttpStatusCode.OK, home.StatusCode);
        var homeBody = await ReadJsonAsync<JsonElement>(home);
        Assert.Equal(0, homeBody.GetProperty("summary").GetProperty("completedActivities").GetInt32());
        Assert.Empty(homeBody.GetProperty("recentActivities").EnumerateArray());

        var logout = await anonymous.SendAsync(CookieRequest(HttpMethod.Post, "/api/v1/student-portal/logout", PortalCookie, portalToken));
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        var afterLogout = await anonymous.SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/me", PortalCookie, portalToken));
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
    }

    [Fact]
    public async Task RotationRevocationAndDeactivation_InvalidateExpectedPortalAccess()
    {
        var teacher = NewClient();
        var token = await RegisterConfirmLoginAsync(teacher);
        var tenantId = await CreateTenantAsync(teacher, token, "Portal lifecycle");
        var student = await CreateStudentAsync(teacher, token, tenantId, "سارة محمد");
        var studentId = student.GetProperty("id").GetGuid();

        var access1 = await CreatePortalAccessAsync(teacher, token, tenantId, studentId);
        var login1 = await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access1 }));
        Assert.Equal(HttpStatusCode.OK, login1.StatusCode);
        var session1 = ReadCookie(login1, PortalCookie);

        var access2 = await CreatePortalAccessAsync(teacher, token, tenantId, studentId);
        Assert.NotEqual(access1, access2);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access1 }))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/me", PortalCookie, session1))).StatusCode);

        var login2 = await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access2 }));
        Assert.Equal(HttpStatusCode.OK, login2.StatusCode);
        var session2 = ReadCookie(login2, PortalCookie);

        var currentStudent = await GetStudentAsync(teacher, token, tenantId, studentId);
        var deactivate = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/status",
            token,
            new { isActive = false, baseVersion = currentStudent.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/me", PortalCookie, session2))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access2 }))).StatusCode);

        var deactivated = await ReadJsonAsync<JsonElement>(deactivate);
        var reactivate = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/status",
            token,
            new { isActive = true, baseVersion = deactivated.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access2 }))).StatusCode);

        var revoke = await teacher.SendAsync(Authorized(
            HttpMethod.Delete,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access",
            token));
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode = access2 }))).StatusCode);
    }

    [Fact]
    public async Task PortalJoin_AutoBindsSameTenant_RejectsCrossTenant_AndGuestStillWorks()
    {
        var ownerA = NewClient();
        var tokenA = await RegisterConfirmLoginAsync(ownerA);
        var tenantA = await CreateTenantAsync(ownerA, tokenA, "Portal A");
        var studentA = await CreateStudentAsync(ownerA, tokenA, tenantA, "ليان خالد");
        var studentId = studentA.GetProperty("id").GetGuid();
        var accessCode = await CreatePortalAccessAsync(ownerA, tokenA, tenantA, studentId);
        var (_, _, joinCodeA) = await CreateActiveSessionAsync(ownerA, tokenA, tenantA, "portal-a");

        var portalClient = NewClient();
        var login = await portalClient.PostAsync("/api/v1/student-portal/login", Json(new { accessCode }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var portalToken = ReadCookie(login, PortalCookie);

        var portalJoin = await portalClient.SendAsync(CookieRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCodeA}/portal-join",
            PortalCookie,
            portalToken));
        Assert.Equal(HttpStatusCode.OK, portalJoin.StatusCode);
        var joined = await ReadJsonAsync<JsonElement>(portalJoin);
        Assert.Equal("ليان خالد", joined.GetProperty("displayName").GetString());
        var guestToken = ReadCookie(portalJoin, GuestCookie);

        var start = await portalClient.SendAsync(CookieRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCodeA}/attempts",
            GuestCookie,
            guestToken));
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        var attemptId = (await ReadJsonAsync<JsonElement>(start)).GetProperty("attemptId").GetGuid();

        var home = await portalClient.SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/home", PortalCookie, portalToken));
        Assert.Equal(HttpStatusCode.OK, home.StatusCode);
        var homeBody = await ReadJsonAsync<JsonElement>(home);
        Assert.Equal(attemptId, homeBody.GetProperty("continueActivity").GetProperty("attemptId").GetGuid());
        Assert.Equal(joinCodeA, homeBody.GetProperty("continueActivity").GetProperty("joinCode").GetString());

        var ownerB = NewClient();
        var tokenB = await RegisterConfirmLoginAsync(ownerB);
        var tenantB = await CreateTenantAsync(ownerB, tokenB, "Portal B");
        var (_, _, joinCodeB) = await CreateActiveSessionAsync(ownerB, tokenB, tenantB, "portal-b");

        var crossTenant = await portalClient.SendAsync(CookieRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCodeB}/portal-join",
            PortalCookie,
            portalToken));
        Assert.Equal(HttpStatusCode.NotFound, crossTenant.StatusCode);

        var guestJoin = await NewClient().PostAsync(
            $"/api/v1/player/sessions/{joinCodeB}/join",
            Json(new { displayName = "ضيف" }));
        Assert.Equal(HttpStatusCode.OK, guestJoin.StatusCode);
    }

    private async Task<string> CreatePortalAccessAsync(HttpClient client, string token, Guid tenantId, Guid studentId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access",
            token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("accessCode").GetString()!;
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"portal-flow-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Portal Test Teacher"
        }));
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);

        var confirmUrl = _factory.EmailSender.LastActionUrlFor(
            email,
            TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var confirmUri = new Uri(confirmUrl);
        var query = System.Web.HttpUtility.ParseQueryString(confirmUri.Query);
        var confirm = await client.PostAsync("/api/v1/auth/confirm-email", Json(new
        {
            uid = query["uid"],
            token = query["token"]
        }));
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var login = await client.PostAsync("/api/v1/auth/login", Json(new { email, password = "SecurePassword123!" }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string accessToken, string name)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            "/api/v1/tenants",
            accessToken,
            new
            {
                name,
                slug = $"portal-{Guid.NewGuid():N}"[..24],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> CreateStudentAsync(HttpClient client, string accessToken, Guid tenantId, string name)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            accessToken,
            new { fullName = name, grade = "Level A", notes = (string?)null }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static async Task<JsonElement> GetStudentAsync(HttpClient client, string accessToken, Guid tenantId, Guid studentId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students/{studentId}",
            accessToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static async Task<(Guid QuizId, Guid SessionId, string JoinCode)> CreateActiveSessionAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        string slugPrefix)
    {
        var bankResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks",
            accessToken,
            new { name = "Portal Bank" }));
        Assert.Equal(HttpStatusCode.Created, bankResponse.StatusCode);
        var bankId = (await ReadJsonAsync<JsonElement>(bankResponse)).GetProperty("id").GetGuid();

        var questionResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions",
            accessToken,
            new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "اختر الإجابة الصحيحة",
                options = new object[]
                {
                    new { text = "صحيح", isCorrect = true },
                    new { text = "خطأ", isCorrect = false }
                }
            }));
        Assert.Equal(HttpStatusCode.Created, questionResponse.StatusCode);
        var questionId = (await ReadJsonAsync<JsonElement>(questionResponse)).GetProperty("id").GetGuid();

        var quizResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes",
            accessToken,
            new { title = "Portal Quiz", description = "Portal integration", passingPercentage = 50, shuffleQuestions = false }));
        Assert.Equal(HttpStatusCode.Created, quizResponse.StatusCode);
        var quiz = await ReadJsonAsync<JsonElement>(quizResponse);
        var quizId = quiz.GetProperty("id").GetGuid();

        var addQuestion = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items",
            accessToken,
            new { questionId }));
        Assert.Equal(HttpStatusCode.OK, addQuestion.StatusCode);

        var publish = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish",
            accessToken,
            new { baseVersion = quiz.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);

        var sessionResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions",
            accessToken,
            new { mode = "SelfPaced", label = slugPrefix }));
        Assert.Equal(HttpStatusCode.Created, sessionResponse.StatusCode);
        var session = await ReadJsonAsync<JsonElement>(sessionResponse);
        var sessionId = session.GetProperty("id").GetGuid();
        var joinCode = session.GetProperty("joinCode").GetString()!;

        var activate = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate",
            accessToken,
            new { baseVersion = session.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);
        return (quizId, sessionId, joinCode);
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string url, string accessToken, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static HttpRequestMessage CookieRequest(HttpMethod method, string url, string cookieName, string cookieValue)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{cookieName}={cookieValue}");
        return request;
    }

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(), JsonOptions)!;

    private static string GetSetCookie(HttpResponseMessage response) =>
        string.Join("; ", response.Headers.TryGetValues("Set-Cookie", out var values) ? values : []);

    private static string ReadCookie(HttpResponseMessage response, string cookieName)
    {
        var setCookie = response.Headers.GetValues("Set-Cookie")
            .First(value => value.StartsWith(cookieName + "=", StringComparison.OrdinalIgnoreCase));
        return setCookie[(cookieName.Length + 1)..].Split(';', 2)[0];
    }
}
