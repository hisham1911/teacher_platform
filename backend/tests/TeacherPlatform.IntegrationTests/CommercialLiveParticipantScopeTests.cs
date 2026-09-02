using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.IntegrationTests.Infrastructure;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class CommercialLiveParticipantScopeTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TestWebApplicationFactory _factory;

    public CommercialLiveParticipantScopeTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task MaxLiveParticipants_DoesNotLimitSelfPaced_ButDoesLimitLive()
    {
        var teacherClient = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(teacherClient, "Live Scope Owner");
        var tenantId = await CreateTenantAsync(teacherClient, owner.Token, "Live Scope Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(teacherClient, owner.Email);

        var planId = await CreatePlanAsync(teacherClient, adminToken, maxLiveParticipants: 1);
        var activation = await teacherClient.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new { planId, changeReason = "Live scope regression" }));
        Assert.Equal(HttpStatusCode.OK, activation.StatusCode);

        var quizId = await CreatePublishedQuizAsync(teacherClient, adminToken, tenantId);
        var selfPaced = await CreateAndActivateSessionAsync(
            teacherClient,
            adminToken,
            tenantId,
            quizId,
            "SelfPaced");

        var selfPacedStudentOne = _factory.CreateClient();
        var selfPacedStudentTwo = _factory.CreateClient();
        var selfPacedJoinOne = await selfPacedStudentOne.PostAsJsonAsync(
            $"/api/v1/player/sessions/{selfPaced.JoinCode}/join",
            new { displayName = "Self Paced One" });
        var selfPacedJoinTwo = await selfPacedStudentTwo.PostAsJsonAsync(
            $"/api/v1/player/sessions/{selfPaced.JoinCode}/join",
            new { displayName = "Self Paced Two" });

        Assert.Equal(HttpStatusCode.OK, selfPacedJoinOne.StatusCode);
        Assert.Equal(HttpStatusCode.OK, selfPacedJoinTwo.StatusCode);

        var live = await CreateAndActivateSessionAsync(
            teacherClient,
            adminToken,
            tenantId,
            quizId,
            "Live");

        var liveStudentOne = _factory.CreateClient();
        var liveStudentTwo = _factory.CreateClient();
        var liveJoinOne = await liveStudentOne.PostAsJsonAsync(
            $"/api/v1/player/sessions/{live.JoinCode}/join",
            new { displayName = "Live One" });
        var liveJoinTwo = await liveStudentTwo.PostAsJsonAsync(
            $"/api/v1/player/sessions/{live.JoinCode}/join",
            new { displayName = "Live Two" });

        Assert.Equal(HttpStatusCode.OK, liveJoinOne.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, liveJoinTwo.StatusCode);
        var problem = await liveJoinTwo.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("QuotaExceeded", problem.GetProperty("errorCode").GetString());
    }

    private async Task<(string Email, string Token)> RegisterConfirmLoginAsync(
        HttpClient client,
        string fullName)
    {
        var email = $"live-scope-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "SecurePassword123!",
            fullName
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
        return (email, await LoginAsync(client, email));
    }

    private static async Task<string> LoginAsync(HttpClient client, string email)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "SecurePassword123!"
        });
        login.EnsureSuccessStatusCode();
        return (await login.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("accessToken")
            .GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(
        HttpClient client,
        string token,
        string name)
    {
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            "/api/v1/tenants",
            token,
            new
            {
                name,
                slug = $"live-scope-{Guid.NewGuid():N}"[..30],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private async Task GrantPlatformAdminAsync(string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        if (!await roles.RoleExistsAsync(PlatformRoles.PlatformAdmin))
        {
            var roleResult = await roles.CreateAsync(new ApplicationRole { Name = PlatformRoles.PlatformAdmin });
            Assert.True(roleResult.Succeeded, string.Join(';', roleResult.Errors.Select(error => error.Description)));
        }

        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email) ?? throw new InvalidOperationException("User missing.");
        if (!await users.IsInRoleAsync(user, PlatformRoles.PlatformAdmin))
        {
            var result = await users.AddToRoleAsync(user, PlatformRoles.PlatformAdmin);
            Assert.True(result.Succeeded, string.Join(';', result.Errors.Select(error => error.Description)));
        }
    }

    private static async Task<Guid> CreatePlanAsync(
        HttpClient client,
        string adminToken,
        int maxLiveParticipants)
    {
        var code = $"live-scope-{Guid.NewGuid():N}"[..30];
        var response = await client.SendAsync(Authorized(
            HttpMethod.Post,
            "/api/v1/platform/plans",
            adminToken,
            new
            {
                code,
                name = $"Live Scope {code[^6..]}",
                isActive = true,
                contract = new
                {
                    contractVersion = 2,
                    package = "TeacherPro",
                    limits = new
                    {
                        maxQuizzesPerTenant = 100,
                        maxQuestionsPerQuiz = 200,
                        maxPublishedQuizzesPerTenant = 50,
                        maxAttemptsPerMonth = 10_000,
                        maxStorageBytes = 5L * 1024 * 1024 * 1024,
                        maxCertificatesPerMonth = 10_000,
                        maxStudents = 100,
                        maxMembers = 10,
                        maxClasses = 100,
                        maxActiveAssignments = 500,
                        maxLiveParticipants
                    },
                    entitlements = new
                    {
                        bulkImport = true,
                        advancedReports = true,
                        certificates = true,
                        customBranding = true,
                        dataExport = true,
                        customDomain = false
                    }
                }
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client,
        string token,
        Guid tenantId)
    {
        var bankResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks",
            token,
            new { name = "Live Scope Bank" }));
        Assert.Equal(HttpStatusCode.Created, bankResponse.StatusCode);
        var bankId = (await bankResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var questionResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions",
            token,
            new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "Choose one",
                options = new object[]
                {
                    new { text = "Correct", isCorrect = true },
                    new { text = "Wrong", isCorrect = false }
                }
            }));
        Assert.Equal(HttpStatusCode.Created, questionResponse.StatusCode);
        var questionId = (await questionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var quizResponse = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes",
            token,
            new
            {
                title = "Live Scope Activity",
                slug = $"live-scope-{Guid.NewGuid():N}",
                description = "Commercial live quota regression"
            }));
        Assert.Equal(HttpStatusCode.Created, quizResponse.StatusCode);
        var quiz = await quizResponse.Content.ReadFromJsonAsync<JsonElement>();
        var quizId = quiz.GetProperty("id").GetGuid();

        var addQuestion = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items",
            token,
            new { questionId }));
        Assert.Equal(HttpStatusCode.OK, addQuestion.StatusCode);

        var publish = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish",
            token,
            new { baseVersion = quiz.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        return quizId;
    }

    private static async Task<(Guid Id, string JoinCode)> CreateAndActivateSessionAsync(
        HttpClient client,
        string token,
        Guid tenantId,
        Guid quizId,
        string mode)
    {
        var create = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions",
            token,
            new { mode, label = $"{mode} quota scope" }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var session = await create.Content.ReadFromJsonAsync<JsonElement>();
        var id = session.GetProperty("id").GetGuid();
        var joinCode = session.GetProperty("joinCode").GetString()!;
        var baseVersion = session.GetProperty("version").GetUInt32();

        var activate = await client.SendAsync(Authorized(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{id}/activate",
            token,
            new { baseVersion }));
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);
        return (id, joinCode);
    }

    private static HttpRequestMessage Authorized(
        HttpMethod method,
        string path,
        string token,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null)
        {
            request.Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOptions),
                Encoding.UTF8,
                "application/json");
        }
        return request;
    }
}
