using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.IntegrationTests.Infrastructure;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class SubscriptionSchedulingSafetyTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;

    public SubscriptionSchedulingSafetyTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task FuturePlanChange_IsRejected_WithoutCancellingCurrentSubscription()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Scheduling Safety Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Scheduling Safety Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var currentPlanId = await CreatePlanAsync(client, adminToken, "TeacherPro");
        var currentActivation = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new { planId = currentPlanId, changeReason = "Initial activation" }));
        Assert.Equal(HttpStatusCode.OK, currentActivation.StatusCode);
        var currentActivationBody = await currentActivation.Content.ReadFromJsonAsync<JsonElement>();
        var currentPlanCode = currentActivationBody.GetProperty("planCode").GetString();
        Assert.False(string.IsNullOrWhiteSpace(currentPlanCode));

        var futurePlanId = await CreatePlanAsync(client, adminToken, "Academy");
        var futureActivation = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new
            {
                planId = futurePlanId,
                startsAt = DateTime.UtcNow.AddDays(2),
                changeReason = "Unsafe future schedule should be rejected"
            }));

        Assert.Equal(HttpStatusCode.BadRequest, futureActivation.StatusCode);
        var problem = await futureActivation.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ValidationError", problem.GetProperty("errorCode").GetString());

        var stateResponse = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/commercial",
            owner.Token,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, stateResponse.StatusCode);
        var state = await stateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Active", state.GetProperty("commercialStatus").GetString());
        Assert.Equal(currentPlanCode, state.GetProperty("plan").GetProperty("code").GetString());
    }

    private async Task<(string Email, string Token)> RegisterConfirmLoginAsync(HttpClient client, string fullName)
    {
        var email = $"schedule-{Guid.NewGuid():N}@example.test";
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

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token, string name)
    {
        var response = await client.SendAsync(Request(
            HttpMethod.Post,
            "/api/v1/tenants",
            token,
            new
            {
                name,
                slug = $"schedule-{Guid.NewGuid():N}"[..30],
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

    private static async Task<Guid> CreatePlanAsync(HttpClient client, string adminToken, string packageName)
    {
        var code = $"schedule-{Guid.NewGuid():N}"[..30];
        var response = await client.SendAsync(Request(
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
                        maxMembers = 10,
                        maxClasses = 100,
                        maxActiveAssignments = 500,
                        maxLiveParticipants = 100
                    },
                    entitlements = new
                    {
                        bulkImport = true,
                        advancedReports = true,
                        certificates = true,
                        customBranding = packageName != "Teacher",
                        dataExport = true,
                        customDomain = false
                    }
                }
            }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static HttpRequestMessage Request(
        HttpMethod method,
        string path,
        string token,
        object? body = null,
        Guid? tenantId = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (tenantId is Guid id)
        {
            request.Headers.Add("X-Tenant-Id", id.ToString());
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }
}
