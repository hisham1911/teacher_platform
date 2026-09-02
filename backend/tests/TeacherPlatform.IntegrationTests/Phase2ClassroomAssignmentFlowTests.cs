using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class Phase2ClassroomAssignmentFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private const string PortalCookie = "tp-student";
    private const string GuestCookie = "tp-guest";
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public Phase2ClassroomAssignmentFlowTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    [Fact]
    public async Task ClassroomAssignment_SnapshotsRecipients_StudentTasksStayPrivate_AndManagedPlayerResumes()
    {
        var teacher = NewClient();
        var token = await RegisterConfirmLoginAsync(teacher, "phase2-owner");
        var tenantId = await CreateTenantAsync(teacher, token, "Phase 2 Workspace");
        var studentA = await CreateStudentAsync(teacher, token, tenantId, "Student A");
        var studentB = await CreateStudentAsync(teacher, token, tenantId, "Student B");
        var outsider = await CreateStudentAsync(teacher, token, tenantId, "Outside Student");
        var studentAId = studentA.GetProperty("id").GetGuid();
        var studentBId = studentB.GetProperty("id").GetGuid();
        var outsiderId = outsider.GetProperty("id").GetGuid();

        var classroomResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/classrooms",
            token,
            new { name = "Class A", academicYear = "2026/2027" }));
        Assert.Equal(HttpStatusCode.Created, classroomResponse.StatusCode);
        var classroom = await ReadJsonAsync<JsonElement>(classroomResponse);
        var classroomId = classroom.GetProperty("id").GetGuid();

        await AddStudentToClassAsync(teacher, token, tenantId, classroomId, studentAId);
        await AddStudentToClassAsync(teacher, token, tenantId, classroomId, studentBId);
        await AddStudentToClassAsync(teacher, token, tenantId, classroomId, studentAId); // idempotent membership

        var classDetails = await teacher.SendAsync(Authorized(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/classrooms/{classroomId}", token));
        Assert.Equal(HttpStatusCode.OK, classDetails.StatusCode);
        Assert.Equal(2, (await ReadJsonAsync<JsonElement>(classDetails)).GetProperty("studentCount").GetInt32());

        var published = await CreatePublishedQuizAsync(teacher, token, tenantId, "phase2-classroom");
        var assignmentResponse = await teacher.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/assignments",
            token,
            new
            {
                quizVersionId = published.PublishedVersionId,
                classroomIds = new[] { classroomId },
                studentIds = Array.Empty<Guid>(),
                availableAt = (DateTime?)null,
                dueAt = DateTime.UtcNow.AddDays(2)
            }));
        Assert.Equal(HttpStatusCode.Created, assignmentResponse.StatusCode);
        var assignment = await ReadJsonAsync<JsonElement>(assignmentResponse);
        var assignmentId = assignment.GetProperty("id").GetGuid();
        Assert.Equal(published.PublishedVersionId, assignment.GetProperty("quizVersionId").GetGuid());
        Assert.Equal(2, assignment.GetProperty("recipientCount").GetInt32());

        // Classroom membership changes after creation must not mutate the assignment snapshot.
        var remove = await teacher.SendAsync(Authorized(HttpMethod.Delete,
            $"/api/v1/tenants/{tenantId}/classrooms/{classroomId}/students/{studentBId}", token));
        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);
        var recipients = await teacher.SendAsync(Authorized(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/assignments/{assignmentId}/recipients", token));
        Assert.Equal(HttpStatusCode.OK, recipients.StatusCode);
        Assert.Equal(2, (await ReadJsonAsync<JsonElement>(recipients)).GetArrayLength());

        var accessA = await CreatePortalAccessAsync(teacher, token, tenantId, studentAId);
        var accessB = await CreatePortalAccessAsync(teacher, token, tenantId, studentBId);
        var accessOutside = await CreatePortalAccessAsync(teacher, token, tenantId, outsiderId);
        var portalA = await LoginPortalAsync(accessA);
        var portalB = await LoginPortalAsync(accessB);
        var portalOutside = await LoginPortalAsync(accessOutside);

        var tasksA = await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/tasks", PortalCookie, portalA));
        var tasksB = await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/tasks", PortalCookie, portalB));
        var tasksOutside = await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/tasks", PortalCookie, portalOutside));
        Assert.Equal(HttpStatusCode.OK, tasksA.StatusCode);
        Assert.Equal(HttpStatusCode.OK, tasksB.StatusCode);
        Assert.Equal(HttpStatusCode.OK, tasksOutside.StatusCode);
        Assert.Single((await ReadJsonAsync<JsonElement>(tasksA)).EnumerateArray());
        Assert.Single((await ReadJsonAsync<JsonElement>(tasksB)).EnumerateArray());
        Assert.Empty((await ReadJsonAsync<JsonElement>(tasksOutside)).EnumerateArray());

        var guestPersistentRead = await NewClient().GetAsync("/api/v1/student-portal/tasks");
        Assert.Equal(HttpStatusCode.Unauthorized, guestPersistentRead.StatusCode);
        var outsiderStart = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/student-portal/tasks/{assignmentId}/start", PortalCookie, portalOutside));
        Assert.Equal(HttpStatusCode.NotFound, outsiderStart.StatusCode);

        var startA1 = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/student-portal/tasks/{assignmentId}/start", PortalCookie, portalA));
        Assert.Equal(HttpStatusCode.OK, startA1.StatusCode);
        var startBody1 = await ReadJsonAsync<JsonElement>(startA1);
        var participantId = startBody1.GetProperty("participantId").GetGuid();
        var joinCode = startBody1.GetProperty("joinCode").GetString()!;

        // Managed assignment sessions are not a back door for anonymous Quick Join.
        var guestJoin = await NewClient().PostAsync($"/api/v1/player/sessions/{joinCode}/join", Json(new { displayName = "Guest" }));
        Assert.Equal(HttpStatusCode.NotFound, guestJoin.StatusCode);

        // Starting again rotates the guest token but resolves the same managed participant.
        var startA2 = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/student-portal/tasks/{assignmentId}/start", PortalCookie, portalA));
        Assert.Equal(HttpStatusCode.OK, startA2.StatusCode);
        var startBody2 = await ReadJsonAsync<JsonElement>(startA2);
        Assert.Equal(participantId, startBody2.GetProperty("participantId").GetGuid());
        var guestToken = ReadCookie(startA2, GuestCookie);

        var attemptStart = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts", GuestCookie, guestToken));
        Assert.Equal(HttpStatusCode.OK, attemptStart.StatusCode);
        var attemptId = (await ReadJsonAsync<JsonElement>(attemptStart)).GetProperty("attemptId").GetGuid();
        var attemptAgain = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts", GuestCookie, guestToken));
        Assert.Equal(HttpStatusCode.OK, attemptAgain.StatusCode);
        Assert.Equal(attemptId, (await ReadJsonAsync<JsonElement>(attemptAgain)).GetProperty("attemptId").GetGuid());

        var inProgressTasks = await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/tasks", PortalCookie, portalA));
        var inProgressTask = (await ReadJsonAsync<JsonElement>(inProgressTasks)).EnumerateArray().Single();
        Assert.Equal("InProgress", inProgressTask.GetProperty("state").GetString());

        var questionResponse = await NewClient().SendAsync(CookieRequest(HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question", GuestCookie, guestToken));
        Assert.Equal(HttpStatusCode.OK, questionResponse.StatusCode);
        var question = await ReadJsonAsync<JsonElement>(questionResponse);
        var optionId = question.GetProperty("options")[0].GetProperty("optionId").GetGuid();
        var answer = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers", GuestCookie, guestToken,
            new { quizVersionItemId = question.GetProperty("quizVersionItemId").GetGuid(), answerJson = JsonSerializer.Serialize(new { optionId }) }));
        Assert.Equal(HttpStatusCode.OK, answer.StatusCode);

        var finish = await NewClient().SendAsync(CookieRequest(HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish", GuestCookie, guestToken));
        Assert.Equal(HttpStatusCode.OK, finish.StatusCode);

        var completedTasks = await NewClient().SendAsync(CookieRequest(HttpMethod.Get, "/api/v1/student-portal/tasks", PortalCookie, portalA));
        var completedTask = (await ReadJsonAsync<JsonElement>(completedTasks)).EnumerateArray().Single();
        Assert.Equal("Completed", completedTask.GetProperty("state").GetString());
        Assert.Equal(100m, completedTask.GetProperty("progressPercentage").GetDecimal());

        var results = await teacher.SendAsync(Authorized(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/assignments/{assignmentId}/results", token));
        Assert.Equal(HttpStatusCode.OK, results.StatusCode);
        var resultRows = (await ReadJsonAsync<JsonElement>(results)).EnumerateArray().ToList();
        Assert.Equal(2, resultRows.Count);
        Assert.Contains(resultRows, row => row.GetProperty("studentId").GetGuid() == studentAId && row.GetProperty("attemptId").GetGuid() == attemptId);
    }

    [Fact]
    public async Task Phase2Resources_RejectCrossTenantIds_AndInvalidAssignmentDates()
    {
        var teacherA = NewClient();
        var tokenA = await RegisterConfirmLoginAsync(teacherA, "phase2-a");
        var tenantA = await CreateTenantAsync(teacherA, tokenA, "Tenant A");
        var studentA = await CreateStudentAsync(teacherA, tokenA, tenantA, "A Student");
        var studentAId = studentA.GetProperty("id").GetGuid();
        var classAResponse = await teacherA.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantA}/classrooms", tokenA, new { name = "A Class", academicYear = (string?)null }));
        Assert.Equal(HttpStatusCode.Created, classAResponse.StatusCode);
        var classA = (await ReadJsonAsync<JsonElement>(classAResponse)).GetProperty("id").GetGuid();
        await AddStudentToClassAsync(teacherA, tokenA, tenantA, classA, studentAId);
        var publishedA = await CreatePublishedQuizAsync(teacherA, tokenA, tenantA, "tenant-a");

        var teacherB = NewClient();
        var tokenB = await RegisterConfirmLoginAsync(teacherB, "phase2-b");
        var tenantB = await CreateTenantAsync(teacherB, tokenB, "Tenant B");
        var studentB = await CreateStudentAsync(teacherB, tokenB, tenantB, "B Student");
        var studentBId = studentB.GetProperty("id").GetGuid();
        var publishedB = await CreatePublishedQuizAsync(teacherB, tokenB, tenantB, "tenant-b");

        var crossStudent = await teacherA.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/classrooms/{classA}/students", tokenA, new { studentId = studentBId }));
        Assert.Equal(HttpStatusCode.NotFound, crossStudent.StatusCode);

        var crossVersion = await teacherA.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/assignments", tokenA,
            new { quizVersionId = publishedB.PublishedVersionId, classroomIds = Array.Empty<Guid>(), studentIds = new[] { studentAId }, availableAt = (DateTime?)null, dueAt = (DateTime?)null }));
        Assert.Equal(HttpStatusCode.NotFound, crossVersion.StatusCode);

        var now = DateTime.UtcNow.AddHours(1);
        var invalidDates = await teacherA.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/assignments", tokenA,
            new { quizVersionId = publishedA.PublishedVersionId, classroomIds = Array.Empty<Guid>(), studentIds = new[] { studentAId }, availableAt = now, dueAt = now }));
        Assert.Equal(HttpStatusCode.BadRequest, invalidDates.StatusCode);

        var assignmentResponse = await teacherA.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/assignments", tokenA,
            new { quizVersionId = publishedA.PublishedVersionId, classroomIds = new[] { classA }, studentIds = Array.Empty<Guid>(), availableAt = (DateTime?)null, dueAt = DateTime.UtcNow.AddDays(1) }));
        Assert.Equal(HttpStatusCode.Created, assignmentResponse.StatusCode);
        var assignmentId = (await ReadJsonAsync<JsonElement>(assignmentResponse)).GetProperty("id").GetGuid();

        var crossAssignmentRead = await teacherB.SendAsync(Authorized(HttpMethod.Get,
            $"/api/v1/tenants/{tenantB}/assignments/{assignmentId}", tokenB));
        Assert.Equal(HttpStatusCode.NotFound, crossAssignmentRead.StatusCode);

        var crossClassRead = await teacherB.SendAsync(Authorized(HttpMethod.Get,
            $"/api/v1/tenants/{tenantB}/classrooms/{classA}", tokenB));
        Assert.Equal(HttpStatusCode.NotFound, crossClassRead.StatusCode);
    }

    private async Task AddStudentToClassAsync(HttpClient client, string token, Guid tenantId, Guid classroomId, Guid studentId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/classrooms/{classroomId}/students", token, new { studentId }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<string> CreatePortalAccessAsync(HttpClient client, string token, Guid tenantId, Guid studentId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students/{studentId}/portal-access", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("accessCode").GetString()!;
    }

    private async Task<string> LoginPortalAsync(string accessCode)
    {
        var response = await NewClient().PostAsync("/api/v1/student-portal/login", Json(new { accessCode }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return ReadCookie(response, PortalCookie);
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client, string prefix)
    {
        var email = $"{prefix}-{Guid.NewGuid():N}@example.test";
        var password = "SecurePassword123!";
        var register = await client.PostAsync("/api/v1/auth/register", Json(new { email, password, fullName = "Phase 2 Test Teacher" }));
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var query = System.Web.HttpUtility.ParseQueryString(new Uri(confirmUrl).Query);
        var confirm = await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid = query["uid"], token = query["token"] }));
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var login = await client.PostAsync("/api/v1/auth/login", Json(new { email, password }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token, string name)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, "/api/v1/tenants", token,
            new { name, slug = $"phase2-{Guid.NewGuid():N}"[..24], countryCode = "EG", timezone = "Africa/Cairo", defaultLocale = "ar" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> CreateStudentAsync(HttpClient client, string token, Guid tenantId, string name)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/students", token,
            new { fullName = name, grade = "Level A", notes = (string?)null }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static async Task<(Guid QuizId, Guid PublishedVersionId)> CreatePublishedQuizAsync(HttpClient client, string token, Guid tenantId, string slugPrefix)
    {
        var bankResponse = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/question-banks", token, new { name = "Phase 2 Bank" }));
        Assert.Equal(HttpStatusCode.Created, bankResponse.StatusCode);
        var bankId = (await ReadJsonAsync<JsonElement>(bankResponse)).GetProperty("id").GetGuid();

        var questionResponse = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/questions", token,
            new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "Choose one",
                options = new object[] { new { text = "Correct", isCorrect = true }, new { text = "Wrong", isCorrect = false } }
            }));
        Assert.Equal(HttpStatusCode.Created, questionResponse.StatusCode);
        var questionId = (await ReadJsonAsync<JsonElement>(questionResponse)).GetProperty("id").GetGuid();

        var quizResponse = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes", token,
            new { title = "Phase 2 Activity", slug = $"{slugPrefix}-{Guid.NewGuid():N}", description = "Phase 2 integration" }));
        Assert.Equal(HttpStatusCode.Created, quizResponse.StatusCode);
        var quiz = await ReadJsonAsync<JsonElement>(quizResponse);
        var quizId = quiz.GetProperty("id").GetGuid();
        var addQuestion = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items", token, new { questionId }));
        Assert.Equal(HttpStatusCode.OK, addQuestion.StatusCode);
        var publish = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish", token,
            new { baseVersion = quiz.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        var published = await ReadJsonAsync<JsonElement>(publish);
        return (quizId, published.GetProperty("publishedVersionId").GetGuid());
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string url, string accessToken, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static HttpRequestMessage CookieRequest(HttpMethod method, string url, string cookieName, string cookieValue, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{cookieName}={cookieValue}");
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static StringContent Json(object payload) => new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response) => JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(), JsonOptions)!;
    private static string ReadCookie(HttpResponseMessage response, string cookieName)
    {
        var setCookie = response.Headers.GetValues("Set-Cookie").First(value => value.StartsWith(cookieName + "=", StringComparison.OrdinalIgnoreCase));
        return setCookie[(cookieName.Length + 1)..].Split(';', 2)[0];
    }
}
