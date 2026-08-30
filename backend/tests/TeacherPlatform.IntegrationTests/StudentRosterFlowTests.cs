using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// End-to-end coverage for the managed student roster.
/// These tests intentionally use the public HTTP surface so tenancy, authorization,
/// EF mappings, migrations, player cookies, and the existing attempt engine are exercised together.
/// </summary>
[Trait("Category", "Integration")]
public sealed class StudentRosterFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private const string GuestCookieName = "tp-guest";
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public StudentRosterFlowTests(TestWebApplicationFactory factory)
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
    public async Task RosterCrud_EnforcesTenantIsolation_AndOptimisticConcurrency()
    {
        var ownerA = NewClient();
        var tokenA = await RegisterConfirmLoginAsync(ownerA);
        var tenantA = await CreateTenantAsync(ownerA, tokenA, "Roster A");

        var createResponse = await ownerA.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/students",
            tokenA,
            new { fullName = "سارة أحمد", grade = "Grade 6", notes = "مجموعة السبت" }));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await ReadJsonAsync<JsonElement>(createResponse);

        var studentId = created.GetProperty("id").GetGuid();
        var firstVersion = created.GetProperty("version").GetUInt32();
        var firstCode = created.GetProperty("studentCode").GetString()!;
        Assert.Equal("سارة أحمد", created.GetProperty("fullName").GetString());
        Assert.Equal("Grade 6", created.GetProperty("grade").GetString());
        Assert.True(created.GetProperty("isActive").GetBoolean());
        Assert.InRange(firstCode.Length, 6, 12);

        var listResponse = await ownerA.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/students?search={Uri.EscapeDataString("سارة")}",
            tokenA));
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await ReadJsonAsync<JsonElement>(listResponse);
        Assert.Single(list.EnumerateArray());
        Assert.Equal(studentId, list[0].GetProperty("id").GetGuid());

        var updateResponse = await ownerA.SendAsync(Authorized(
            HttpMethod.Put,
            $"/api/v1/tenants/{tenantA}/students/{studentId}",
            tokenA,
            new { fullName = "سارة أحمد علي", grade = "Grade 7", notes = "تقدمت مستوى", baseVersion = firstVersion }));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await ReadJsonAsync<JsonElement>(updateResponse);
        var secondVersion = updated.GetProperty("version").GetUInt32();
        Assert.NotEqual(firstVersion, secondVersion);
        Assert.Equal("سارة أحمد علي", updated.GetProperty("fullName").GetString());

        var staleUpdate = await ownerA.SendAsync(Authorized(
            HttpMethod.Put,
            $"/api/v1/tenants/{tenantA}/students/{studentId}",
            tokenA,
            new { fullName = "اسم قديم", grade = "Grade 7", notes = (string?)null, baseVersion = firstVersion }));
        Assert.Equal(HttpStatusCode.Conflict, staleUpdate.StatusCode);

        var ownerB = NewClient();
        var tokenB = await RegisterConfirmLoginAsync(ownerB);
        var tenantB = await CreateTenantAsync(ownerB, tokenB, "Roster B");

        var crossTenantRead = await ownerB.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantB}/students/{studentId}",
            tokenB));
        Assert.Equal(HttpStatusCode.NotFound, crossTenantRead.StatusCode);

        var crossTenantMutation = await ownerB.SendAsync(Authorized(
            HttpMethod.Put,
            $"/api/v1/tenants/{tenantB}/students/{studentId}",
            tokenB,
            new { fullName = "محاولة عزل", grade = (string?)null, notes = (string?)null, baseVersion = secondVersion }));
        Assert.Equal(HttpStatusCode.NotFound, crossTenantMutation.StatusCode);
    }

    [Fact]
    public async Task RegenerateAndDeactivate_InvalidateCodeWithoutDeletingHistory()
    {
        var teacher = NewClient();
        var token = await RegisterConfirmLoginAsync(teacher);
        var tenantId = await CreateTenantAsync(teacher, token, "Student lifecycle");
        var student = await CreateStudentAsync(teacher, token, tenantId, "عمر محمد");
        var oldCode = student.GetProperty("studentCode").GetString()!;

        var regenerateResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{student.GetProperty("id").GetGuid()}/regenerate-code",
            token,
            new { baseVersion = student.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, regenerateResponse.StatusCode);
        var regenerated = await ReadJsonAsync<JsonElement>(regenerateResponse);
        var newCode = regenerated.GetProperty("studentCode").GetString()!;
        Assert.NotEqual(oldCode, newCode);

        var deactivateResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{student.GetProperty("id").GetGuid()}/status",
            token,
            new { isActive = false, baseVersion = regenerated.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, deactivateResponse.StatusCode);
        var deactivated = await ReadJsonAsync<JsonElement>(deactivateResponse);
        Assert.False(deactivated.GetProperty("isActive").GetBoolean());

        var defaultListResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students",
            token));
        Assert.Equal(HttpStatusCode.OK, defaultListResponse.StatusCode);
        Assert.Empty((await ReadJsonAsync<JsonElement>(defaultListResponse)).EnumerateArray());

        var allListResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students?includeInactive=true",
            token));
        Assert.Equal(HttpStatusCode.OK, allListResponse.StatusCode);
        var all = await ReadJsonAsync<JsonElement>(allListResponse);
        Assert.Single(all.EnumerateArray());
        Assert.Equal(newCode, all[0].GetProperty("studentCode").GetString());
    }

    [Fact]
    public async Task ManagedJoin_BindsPermanentStudent_AndResumesAttemptAcrossDevices()
    {
        var teacher = NewClient();
        var token = await RegisterConfirmLoginAsync(teacher);
        var tenantId = await CreateTenantAsync(teacher, token, "Managed join");
        var student = await CreateStudentAsync(teacher, token, tenantId, "ليان خالد");
        var studentId = student.GetProperty("id").GetGuid();
        var studentCode = student.GetProperty("studentCode").GetString()!;
        var (quizId, sessionId, joinCode) = await CreateActiveSessionAsync(teacher, token, tenantId, "managed-join");

        var firstDevice = NewClient();
        var (firstJoin, firstGuestToken) = await StudentJoinAsync(firstDevice, joinCode, studentCode);
        var participantId = firstJoin.GetProperty("participantId").GetGuid();
        Assert.Equal("ليان خالد", firstJoin.GetProperty("displayName").GetString());
        Assert.Equal(JsonValueKind.Null, firstJoin.GetProperty("attemptId").ValueKind);

        var startResponse = await firstDevice.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts",
            firstGuestToken));
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);
        var attempt = await ReadJsonAsync<JsonElement>(startResponse);
        var attemptId = attempt.GetProperty("attemptId").GetGuid();

        var secondDevice = NewClient();
        var (secondJoin, secondGuestToken) = await StudentJoinAsync(secondDevice, joinCode, studentCode);
        Assert.Equal(participantId, secondJoin.GetProperty("participantId").GetGuid());
        Assert.Equal(attemptId, secondJoin.GetProperty("attemptId").GetGuid());
        Assert.Equal("InProgress", secondJoin.GetProperty("attemptStatus").GetString());
        Assert.NotEqual(firstGuestToken, secondGuestToken);

        var resumeResponse = await secondDevice.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts",
            secondGuestToken));
        Assert.Equal(HttpStatusCode.OK, resumeResponse.StatusCode);
        var resumed = await ReadJsonAsync<JsonElement>(resumeResponse);
        Assert.Equal(attemptId, resumed.GetProperty("attemptId").GetGuid());

        var session = await GetSessionAsync(teacher, token, tenantId, quizId, sessionId);
        var boundParticipant = session.GetProperty("participants")
            .EnumerateArray()
            .Single(item => item.GetProperty("id").GetGuid() == participantId);
        Assert.Equal("ليان خالد", boundParticipant.GetProperty("displayName").GetString());

        var resultsResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/results",
            token));
        Assert.Equal(HttpStatusCode.OK, resultsResponse.StatusCode);
        var results = await ReadJsonAsync<JsonElement>(resultsResponse);
        Assert.Single(results.EnumerateArray());
        Assert.Equal(attemptId, results[0].GetProperty("attemptId").GetGuid());
        Assert.Equal(sessionId, results[0].GetProperty("sessionId").GetGuid());
    }

    [Fact]
    public async Task ManagedJoin_RejectsInactiveInvalidAndCrossTenantCodes_ButGuestJoinStillWorks()
    {
        var ownerA = NewClient();
        var tokenA = await RegisterConfirmLoginAsync(ownerA);
        var tenantA = await CreateTenantAsync(ownerA, tokenA, "Join A");
        var studentA = await CreateStudentAsync(ownerA, tokenA, tenantA, "طالب أ");

        var ownerB = NewClient();
        var tokenB = await RegisterConfirmLoginAsync(ownerB);
        var tenantB = await CreateTenantAsync(ownerB, tokenB, "Join B");
        var (_, _, joinCodeB) = await CreateActiveSessionAsync(ownerB, tokenB, tenantB, "managed-isolation");

        var anonymous = NewClient();
        var invalidResponse = await anonymous.PostAsync(
            $"/api/v1/player/sessions/{joinCodeB}/student-join",
            Json(new { studentCode = "INVALID8" }));
        Assert.Equal(HttpStatusCode.NotFound, invalidResponse.StatusCode);

        var crossTenantResponse = await anonymous.PostAsync(
            $"/api/v1/player/sessions/{joinCodeB}/student-join",
            Json(new { studentCode = studentA.GetProperty("studentCode").GetString() }));
        Assert.Equal(HttpStatusCode.NotFound, crossTenantResponse.StatusCode);

        var guestResponse = await anonymous.PostAsync(
            $"/api/v1/player/sessions/{joinCodeB}/join",
            Json(new { displayName = "ضيف" }));
        Assert.Equal(HttpStatusCode.OK, guestResponse.StatusCode);

        var studentB = await CreateStudentAsync(ownerB, tokenB, tenantB, "طالب ب");
        var deactivateResponse = await ownerB.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantB}/students/{studentB.GetProperty("id").GetGuid()}/status",
            tokenB,
            new { isActive = false, baseVersion = studentB.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, deactivateResponse.StatusCode);

        var inactiveResponse = await anonymous.PostAsync(
            $"/api/v1/player/sessions/{joinCodeB}/student-join",
            Json(new { studentCode = studentB.GetProperty("studentCode").GetString() }));
        Assert.Equal(HttpStatusCode.NotFound, inactiveResponse.StatusCode);
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"student-flow-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Roster Test Teacher"
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

        var login = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
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
                slug = $"roster-{Guid.NewGuid():N}"[..24],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> CreateStudentAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        string name)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            accessToken,
            new { fullName = name, grade = "Level A", notes = (string?)null }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
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
            new { name = "Roster Bank" }));
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
            new
            {
                title = "نشاط الطلاب",
                slug = $"{slugPrefix}-{Guid.NewGuid():N}"[..Math.Min(45, slugPrefix.Length + 33)],
                description = "اختبار ربط الطالب"
            }));
        Assert.Equal(HttpStatusCode.Created, quizResponse.StatusCode);
        var quizId = (await ReadJsonAsync<JsonElement>(quizResponse)).GetProperty("id").GetGuid();

        var addItemResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items",
            accessToken,
            new { questionId, points = 5, isRequired = true }));
        Assert.Equal(HttpStatusCode.OK, addItemResponse.StatusCode);

        var draftResponse = await client.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft",
            accessToken));
        Assert.Equal(HttpStatusCode.OK, draftResponse.StatusCode);
        var baseVersion = (await ReadJsonAsync<JsonElement>(draftResponse)).GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish",
            accessToken,
            new { baseVersion }));
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        var sessionResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions",
            accessToken,
            new { mode = "SelfPaced", label = "Roster session" }));
        Assert.Equal(HttpStatusCode.Created, sessionResponse.StatusCode);
        var session = await ReadJsonAsync<JsonElement>(sessionResponse);
        var sessionId = session.GetProperty("id").GetGuid();
        var joinCode = session.GetProperty("joinCode").GetString()!;

        var activateResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate",
            accessToken,
            new { baseVersion = session.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, activateResponse.StatusCode);

        return (quizId, sessionId, joinCode);
    }

    private static async Task<JsonElement> GetSessionAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        Guid quizId,
        Guid sessionId)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}",
            accessToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static async Task<(JsonElement Payload, string GuestToken)> StudentJoinAsync(
        HttpClient client,
        string joinCode,
        string studentCode)
    {
        var response = await client.PostAsync(
            $"/api/v1/player/sessions/{joinCode}/student-join",
            Json(new { studentCode }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonAsync<JsonElement>(response);
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var cookies));
        var cookie = cookies!.Single(value => value.StartsWith($"{GuestCookieName}=", StringComparison.Ordinal));
        var token = cookie.Split(';')[0].Substring(GuestCookieName.Length + 1);
        Assert.False(string.IsNullOrWhiteSpace(token));
        return (payload, token);
    }

    private static HttpRequestMessage Authorized(
        HttpMethod method,
        string url,
        string accessToken,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        if (body is not null)
        {
            request.Content = Json(body);
        }
        return request;
    }

    private static HttpRequestMessage PlayerRequest(HttpMethod method, string url, string guestToken)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{GuestCookieName}={guestToken}");
        return request;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }
}
