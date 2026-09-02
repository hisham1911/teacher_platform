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
public sealed class CommercialClassAssignmentLimitsTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly TestWebApplicationFactory _factory;

    public CommercialClassAssignmentLimitsTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task MaxClasses_IsConcurrencySafe_AndUpgradeUnblocksCreation()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Class Limit Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Class Capacity Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var starterPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxClasses: 1,
            maxActiveAssignments: 10,
            packageName: "Teacher");
        await ActivateAsync(client, adminToken, tenantId, starterPlan);

        var responses = await Task.WhenAll(
            client.SendAsync(TenantRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/classrooms",
                adminToken,
                tenantId,
                new { name = "Class One", academicYear = "2026/2027" })),
            client.SendAsync(TenantRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/classrooms",
                adminToken,
                tenantId,
                new { name = "Class Two", academicYear = "2026/2027" })));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        var blocked = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Forbidden);
        Assert.Equal(
            "QuotaExceeded",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());

        var upgradedPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxClasses: 2,
            maxActiveAssignments: 10,
            packageName: "TeacherPro");
        await ActivateAsync(client, adminToken, tenantId, upgradedPlan, "Increase class capacity");

        var retry = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/classrooms",
            adminToken,
            tenantId,
            new { name = "Class After Upgrade", academicYear = "2026/2027" }));
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);

        var state = await ReadCommercialStateAsync(client, adminToken, tenantId);
        Assert.Equal(2, state.GetProperty("usage").GetProperty("classes").GetInt64());
        Assert.Equal(2, state.GetProperty("limits").GetProperty("maxClasses").GetInt32());
    }

    [Fact]
    public async Task MaxActiveAssignments_IsConcurrencySafe_AndUpgradeUnblocksCreation()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Assignment Limit Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Assignment Capacity Space");
        var studentId = await CreateStudentAsync(client, owner.Token, tenantId, "Assigned Student");
        var publishedVersionId = await CreatePublishedQuizAsync(
            client,
            owner.Token,
            tenantId,
            "commercial-assignment");

        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);
        var starterPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxClasses: 5,
            maxActiveAssignments: 1,
            packageName: "Teacher");
        await ActivateAsync(client, adminToken, tenantId, starterPlan);

        object AssignmentBody() => new
        {
            quizVersionId = publishedVersionId,
            classroomIds = Array.Empty<Guid>(),
            studentIds = new[] { studentId },
            availableAt = (DateTime?)null,
            dueAt = DateTime.UtcNow.AddDays(2)
        };

        var responses = await Task.WhenAll(
            client.SendAsync(TenantRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/assignments",
                adminToken,
                tenantId,
                AssignmentBody())),
            client.SendAsync(TenantRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/assignments",
                adminToken,
                tenantId,
                AssignmentBody())));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        var blocked = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Forbidden);
        Assert.Equal(
            "QuotaExceeded",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());

        var upgradedPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxClasses: 5,
            maxActiveAssignments: 2,
            packageName: "TeacherPro");
        await ActivateAsync(
            client,
            adminToken,
            tenantId,
            upgradedPlan,
            "Increase active assignment capacity");

        var retry = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/assignments",
            adminToken,
            tenantId,
            AssignmentBody()));
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);

        var state = await ReadCommercialStateAsync(client, adminToken, tenantId);
        Assert.Equal(2, state.GetProperty("usage").GetProperty("activeAssignments").GetInt64());
        Assert.Equal(
            2,
            state.GetProperty("limits").GetProperty("maxActiveAssignments").GetInt32());
    }

    private async Task<(string Email, string Token)> RegisterConfirmLoginAsync(
        HttpClient client,
        string fullName)
    {
        var email = $"capacity-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "SecurePassword123!",
            fullName
        });
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);

        var confirmation = new Uri(_factory.EmailSender.LastActionUrlFor(
            email,
            EmailKind.Confirmation)!);
        var query = System.Web.HttpUtility.ParseQueryString(confirmation.Query);
        var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm-email", new
        {
            uid = query["uid"],
            token = query["token"]
        });
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        return (email, await LoginAsync(client, email));
    }

    private static async Task<string> LoginAsync(HttpClient client, string email)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password = "SecurePassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await login.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("accessToken")
            .GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(
        HttpClient client,
        string token,
        string name)
    {
        var response = await client.SendAsync(AuthorizedRequest(
            HttpMethod.Post,
            "/api/v1/tenants",
            token,
            new
            {
                name,
                slug = $"capacity-{Guid.NewGuid():N}"[..28],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateStudentAsync(
        HttpClient client,
        string token,
        Guid tenantId,
        string name)
    {
        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            token,
            tenantId,
            new { fullName = name, grade = "Level A", notes = (string?)null }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client,
        string token,
        Guid tenantId,
        string slugPrefix)
    {
        var bankResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks",
            token,
            tenantId,
            new { name = "Commercial Capacity Bank" }));
        Assert.Equal(HttpStatusCode.Created, bankResponse.StatusCode);
        var bankId = (await bankResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var questionResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions",
            token,
            tenantId,
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

        var quizResponse = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes",
            token,
            tenantId,
            new
            {
                title = "Commercial Capacity Activity",
                slug = $"{slugPrefix}-{Guid.NewGuid():N}",
                description = "Commercial capacity integration"
            }));
        Assert.Equal(HttpStatusCode.Created, quizResponse.StatusCode);
        var quiz = await quizResponse.Content.ReadFromJsonAsync<JsonElement>();
        var quizId = quiz.GetProperty("id").GetGuid();

        var addQuestion = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items",
            token,
            tenantId,
            new { questionId }));
        Assert.Equal(HttpStatusCode.OK, addQuestion.StatusCode);

        var publish = await client.SendAsync(TenantRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish",
            token,
            tenantId,
            new { baseVersion = quiz.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        return (await publish.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("publishedVersionId")
            .GetGuid();
    }

    private async Task GrantPlatformAdminAsync(string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        if (!await roles.RoleExistsAsync(PlatformRoles.PlatformAdmin))
        {
            var roleResult = await roles.CreateAsync(new ApplicationRole
            {
                Name = PlatformRoles.PlatformAdmin
            });
            Assert.True(
                roleResult.Succeeded,
                string.Join(';', roleResult.Errors.Select(error => error.Description)));
        }

        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email)
            ?? throw new InvalidOperationException("User missing.");
        if (!await users.IsInRoleAsync(user, PlatformRoles.PlatformAdmin))
        {
            var result = await users.AddToRoleAsync(user, PlatformRoles.PlatformAdmin);
            Assert.True(
                result.Succeeded,
                string.Join(';', result.Errors.Select(error => error.Description)));
        }
    }

    private static async Task<Guid> CreatePlanAsync(
        HttpClient client,
        string adminToken,
        int maxClasses,
        int maxActiveAssignments,
        string packageName)
    {
        var code = $"capacity-{Guid.NewGuid():N}"[..30];
        var response = await client.SendAsync(AuthorizedRequest(
            HttpMethod.Post,
            "/api/v1/platform/plans",
            adminToken,
            new
            {
                code,
                name = $"{packageName} {code[^6..]}",
                isActive = true,
                contract = new
                {
                    contractVersion = 2,
                    package = packageName,
                    limits = new
                    {
                        maxQuizzesPerTenant = 100,
                        maxQuestionsPerQuiz = 200,
                        maxPublishedQuizzesPerTenant = 50,
                        maxAttemptsPerMonth = 10_000,
                        maxStorageBytes = 5L * 1024 * 1024 * 1024,
                        maxCertificatesPerMonth = 10_000,
                        maxStudents = 100,
                        maxMembers = 5,
                        maxClasses,
                        maxActiveAssignments,
                        maxLiveParticipants = 100
                    },
                    entitlements = new
                    {
                        bulkImport = packageName != "Teacher",
                        advancedReports = packageName != "Teacher",
                        certificates = packageName != "Teacher",
                        customBranding = packageName != "Teacher",
                        dataExport = packageName != "Teacher",
                        customDomain = false
                    }
                }
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task ActivateAsync(
        HttpClient client,
        string adminToken,
        Guid tenantId,
        Guid planId,
        string? reason = null)
    {
        var response = await client.SendAsync(AuthorizedRequest(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new { planId, changeReason = reason }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonElement> ReadCommercialStateAsync(
        HttpClient client,
        string token,
        Guid tenantId)
    {
        var response = await client.SendAsync(TenantRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/commercial",
            token,
            tenantId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static HttpRequestMessage TenantRequest(
        HttpMethod method,
        string path,
        string token,
        Guid tenantId,
        object? body = null)
    {
        var request = AuthorizedRequest(method, path, token, body);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        return request;
    }

    private static HttpRequestMessage AuthorizedRequest(
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
