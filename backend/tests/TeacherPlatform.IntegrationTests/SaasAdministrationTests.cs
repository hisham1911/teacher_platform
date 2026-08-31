using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.IntegrationTests.Infrastructure;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class SaasAdministrationTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;

    public SaasAdministrationTests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task PlatformAdmin_ActivatesPlan_EnforcesLimits_AndWritesSafeAudit()
    {
        var client = _factory.CreateClient();
        var email = $"admin-{Guid.NewGuid():N}@example.test";
        var userToken = await RegisterConfirmAndLoginAsync(client, email);
        var tenantId = await CreateTenantAsync(client, userToken);

        var forbidden = await client.SendAsync(Request(HttpMethod.Get, "/api/v1/platform/plans", userToken));
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        await GrantPlatformAdminAsync(email);
        var adminToken = await LoginAsync(client, email);
        var parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(adminToken);
        Assert.Contains(parsedToken.Claims, claim => claim.Type == "role" && claim.Value == PlatformRoles.PlatformAdmin);
        var allowed = await client.SendAsync(Request(HttpMethod.Get, "/api/v1/platform/plans", adminToken));
        Assert.True(allowed.IsSuccessStatusCode, await allowed.Content.ReadAsStringAsync());

        var createPlan = await client.SendAsync(Request(
            HttpMethod.Post,
            "/api/v1/platform/plans",
            adminToken,
            new
            {
                code = $"pilot-{Guid.NewGuid():N}"[..20],
                name = "Pilot",
                isActive = true,
                limits = new
                {
                    maxQuizzesPerTenant = 1,
                    maxQuestionsPerQuiz = 5,
                    maxPublishedQuizzesPerTenant = 1,
                    maxAttemptsPerMonth = 30,
                    maxStorageBytes = 1_048_576,
                    maxCertificatesPerMonth = 30
                }
            }));
        Assert.True(createPlan.StatusCode == HttpStatusCode.Created, $"Expected 201 but received {(int)createPlan.StatusCode}: {await createPlan.Content.ReadAsStringAsync()}");
        var plan = await createPlan.Content.ReadFromJsonAsync<JsonElement>();

        var activate = await client.SendAsync(Request(HttpMethod.Post, $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate", adminToken, new { planId = plan.GetProperty("id").GetGuid() }));
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);

        var usage = await client.SendAsync(Request(HttpMethod.Get, $"/api/v1/platform/tenants/{tenantId}/usage", adminToken));
        Assert.Equal(HttpStatusCode.OK, usage.StatusCode);
        var usagePayload = await usage.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(usagePayload.GetProperty("metrics").EnumerateArray(), metric => metric.GetProperty("metric").GetString() == "Attempts");

        var firstQuiz = await client.SendAsync(Request(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes", adminToken, new { title = "الأول", slug = $"first-{Guid.NewGuid():N}"[..30] }, tenantId));
        Assert.Equal(HttpStatusCode.Created, firstQuiz.StatusCode);

        var secondQuiz = await client.SendAsync(Request(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes", adminToken, new { title = "الثاني", slug = $"second-{Guid.NewGuid():N}"[..30] }, tenantId));
        Assert.Equal(HttpStatusCode.Forbidden, secondQuiz.StatusCode);
        Assert.Equal("QuotaExceeded", (await secondQuiz.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());

        var audit = await client.SendAsync(Request(HttpMethod.Get, $"/api/v1/platform/audit?tenantId={tenantId}", adminToken));
        Assert.Equal(HttpStatusCode.OK, audit.StatusCode);
        var auditText = await audit.Content.ReadAsStringAsync();
        Assert.Contains("SubscriptionActivated", auditText, StringComparison.Ordinal);
        Assert.DoesNotContain("SecurePassword123!", auditText, StringComparison.Ordinal);

        var referral = await client.SendAsync(Request(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/referrals/code", adminToken, tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, referral.StatusCode);
        var firstCode = (await referral.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();
        var repeated = await client.SendAsync(Request(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/referrals/code", adminToken, tenantId: tenantId));
        Assert.Equal(firstCode, (await repeated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task PlatformAdmin_CanSuspendAndRestoreUser_WithoutDeletingAccountData()
    {
        var client = _factory.CreateClient();
        var adminEmail = $"admin-{Guid.NewGuid():N}@example.test";
        await RegisterConfirmAndLoginAsync(client, adminEmail);
        await GrantPlatformAdminAsync(adminEmail);
        var adminToken = await LoginAsync(client, adminEmail);

        var targetEmail = $"teacher-{Guid.NewGuid():N}@example.test";
        await RegisterConfirmAndLoginAsync(client, targetEmail);
        var targetUserId = await FindUserIdAsync(targetEmail);

        var suspend = await client.SendAsync(Request(
            HttpMethod.Put,
            $"/api/v1/platform/users/{targetUserId}/status",
            adminToken,
            new { suspended = true }));
        Assert.Equal(HttpStatusCode.OK, suspend.StatusCode);
        Assert.True((await suspend.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("suspended").GetBoolean());

        var usersAfterSuspend = await client.SendAsync(Request(HttpMethod.Get, "/api/v1/platform/users", adminToken));
        usersAfterSuspend.EnsureSuccessStatusCode();
        var suspendedUser = (await usersAfterSuspend.Content.ReadFromJsonAsync<JsonElement>())
            .EnumerateArray()
            .Single(user => user.GetProperty("id").GetGuid() == targetUserId);
        Assert.Equal("Suspended", suspendedUser.GetProperty("status").GetString());

        var blockedLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = targetEmail, password = "SecurePassword123!" });
        Assert.False(blockedLogin.IsSuccessStatusCode);

        var restore = await client.SendAsync(Request(
            HttpMethod.Put,
            $"/api/v1/platform/users/{targetUserId}/status",
            adminToken,
            new { suspended = false }));
        Assert.Equal(HttpStatusCode.OK, restore.StatusCode);
        Assert.False((await restore.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("suspended").GetBoolean());

        var restoredToken = await LoginAsync(client, targetEmail);
        Assert.False(string.IsNullOrWhiteSpace(restoredToken));

        var audit = await client.SendAsync(Request(HttpMethod.Get, "/api/v1/platform/audit?take=200", adminToken));
        audit.EnsureSuccessStatusCode();
        var auditText = await audit.Content.ReadAsStringAsync();
        Assert.Contains("UserSuspended", auditText, StringComparison.Ordinal);
        Assert.Contains("UserRestored", auditText, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PlatformAdmin_CannotSuspendOwnAccount()
    {
        var client = _factory.CreateClient();
        var email = $"admin-{Guid.NewGuid():N}@example.test";
        await RegisterConfirmAndLoginAsync(client, email);
        await GrantPlatformAdminAsync(email);
        var adminToken = await LoginAsync(client, email);
        var adminUserId = await FindUserIdAsync(email);

        var response = await client.SendAsync(Request(
            HttpMethod.Put,
            $"/api/v1/platform/users/{adminUserId}/status",
            adminToken,
            new { suspended = true }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(await LoginAsync(client, email)));
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
        var result = await users.AddToRoleAsync(user, PlatformRoles.PlatformAdmin);
        Assert.True(result.Succeeded, string.Join(';', result.Errors.Select(error => error.Description)));
    }

    private async Task<Guid> FindUserIdAsync(string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email) ?? throw new InvalidOperationException("User missing.");
        return user.Id;
    }

    private async Task<string> RegisterConfirmAndLoginAsync(HttpClient client, string email)
    {
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password = "SecurePassword123!", fullName = "Platform Admin" });
        register.EnsureSuccessStatusCode();
        var confirmation = new Uri(_factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!);
        var query = System.Web.HttpUtility.ParseQueryString(confirmation.Query);
        var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm-email", new { uid = query["uid"], token = query["token"] });
        confirm.EnsureSuccessStatusCode();
        return await LoginAsync(client, email);
    }

    private static async Task<string> LoginAsync(HttpClient client, string email)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "SecurePassword123!" });
        login.EnsureSuccessStatusCode();
        return (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token)
    {
        var response = await client.SendAsync(Request(HttpMethod.Post, "/api/v1/tenants", token, new { name = "Admin Space", slug = $"admin-{Guid.NewGuid():N}"[..20], countryCode = "EG", timezone = "Africa/Cairo", defaultLocale = "ar" }));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static HttpRequestMessage Request(HttpMethod method, string path, string token, object? body = null, Guid? tenantId = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (tenantId is Guid id) request.Headers.Add("X-Tenant-Id", id.ToString());
        if (body is not null) request.Content = JsonContent.Create(body);
        return request;
    }
}
