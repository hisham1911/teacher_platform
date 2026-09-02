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
public sealed class CommercialSaasPhase4Tests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;

    public CommercialSaasPhase4Tests(TestWebApplicationFactory factory) => _factory = factory;

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task StudentLimit_IsConcurrencySafe_AndUpgradeAllowsRetry()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Student Limit Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Student Limit Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var starterPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 1,
            maxMembers: 3,
            packageName: "Teacher");
        await ActivateAsync(client, adminToken, tenantId, starterPlan);

        var firstRequest = Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            new { fullName = "Concurrent One", grade = "A" },
            tenantId);
        var secondRequest = Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            new { fullName = "Concurrent Two", grade = "A" },
            tenantId);

        var responses = await Task.WhenAll(
            client.SendAsync(firstRequest),
            client.SendAsync(secondRequest));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        var rejected = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Forbidden);
        var problem = await rejected.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("QuotaExceeded", problem.GetProperty("errorCode").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("userMessageAr").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("upgradeGuidanceAr").GetString()));

        var upgradedPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 2,
            maxMembers: 3,
            packageName: "TeacherPro");
        await ActivateAsync(client, adminToken, tenantId, upgradedPlan, "Student capacity upgrade");

        var retry = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            new { fullName = "After Upgrade", grade = "A" },
            tenantId));
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
    }

    [Fact]
    public async Task MemberLimit_CountsOwner_AndUpgradeEnablesStaffMember()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Member Limit Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Member Limit Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var teammateClient = _factory.CreateClient();
        var teammate = await RegisterConfirmLoginAsync(teammateClient, "Second Teacher");

        var soloPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 1,
            packageName: "Teacher");
        await ActivateAsync(client, adminToken, tenantId, soloPlan);

        var blocked = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members",
            adminToken,
            new { email = teammate.Email, role = "Teacher" },
            tenantId));
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal(
            "QuotaExceeded",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());

        var teamPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 2,
            packageName: "Academy");
        await ActivateAsync(client, adminToken, tenantId, teamPlan, "Enable staff member");

        var added = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members",
            adminToken,
            new { email = teammate.Email, role = "Teacher" },
            tenantId));
        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
    }

    [Fact]
    public async Task DataExportEntitlement_IsServerSide_AndUpgradeEnablesIt()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Export Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Export Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var teacherPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 2,
            packageName: "Teacher",
            dataExport: false);
        await ActivateAsync(client, adminToken, tenantId, teacherPlan);

        var blocked = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/transfer/export",
            adminToken,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        var problem = await blocked.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("EntitlementRequired", problem.GetProperty("errorCode").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("upgradeGuidanceAr").GetString()));

        var proPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 2,
            packageName: "TeacherPro",
            dataExport: true);
        await ActivateAsync(client, adminToken, tenantId, proPlan, "Enable secure export");

        var allowed = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/transfer/export",
            adminToken,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        Assert.Equal("application/zip", allowed.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ControlledBranding_IsEntitlementGated_WithoutArbitraryMarkup()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Brand Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Brand Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var teacherPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 2,
            packageName: "Teacher",
            customBranding: false);
        await ActivateAsync(client, adminToken, tenantId, teacherPlan);

        var blocked = await client.SendAsync(Request(
            HttpMethod.Patch,
            $"/api/v1/tenants/{tenantId}/settings",
            adminToken,
            new { brandDisplayName = "Blocked Brand" },
            tenantId));
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal(
            "EntitlementRequired",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());

        var proPlan = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 100,
            maxMembers: 2,
            packageName: "TeacherPro",
            customBranding: true);
        await ActivateAsync(client, adminToken, tenantId, proPlan, "Enable controlled branding");

        var updated = await client.SendAsync(Request(
            HttpMethod.Patch,
            $"/api/v1/tenants/{tenantId}/settings",
            adminToken,
            new
            {
                brandDisplayName = "Maryam Academy",
                studentPortalWelcomeText = "أهلًا بك في مساحة الأكاديمية",
                primaryColor = "#7c3aed",
                secondaryColor = "#f59e0b",
                supportContact = "support@example.test"
            },
            tenantId));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var payload = await updated.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Maryam Academy", payload.GetProperty("brandDisplayName").GetString());

        var unsafeMarkup = await client.SendAsync(Request(
            HttpMethod.Patch,
            $"/api/v1/tenants/{tenantId}/settings",
            adminToken,
            new { settingsJson = "{\"html\":\"<script>alert(1)</script>\"}" },
            tenantId));
        Assert.Equal(HttpStatusCode.BadRequest, unsafeMarkup.StatusCode);
    }

    [Fact]
    public async Task ExpiredSubscription_IsVisible_AndBlocksWorkspaceMutations()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Expired Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Expired Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);
        var planId = await CreatePlanAsync(
            client,
            adminToken,
            maxStudents: 10,
            maxMembers: 2,
            packageName: "TeacherPro");

        var startsAt = DateTime.UtcNow.AddDays(-3);
        var endsAt = DateTime.UtcNow.AddDays(-2);
        var activate = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new { planId, startsAt, endsAt, changeReason = "Expired fixture" }));
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);

        var stateResponse = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/commercial",
            adminToken,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, stateResponse.StatusCode);
        var state = await stateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Expired", state.GetProperty("commercialStatus").GetString());
        Assert.Equal("Expired", state.GetProperty("subscription").GetProperty("status").GetString());

        var blocked = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            new { fullName = "Should Not Be Created", grade = "A" },
            tenantId));
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal(
            "SubscriptionInactive",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WorkspaceSuspension_BlocksTenantSurface_AndReactivationRestoresAccess()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Suspend Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Suspend Space");
        await GrantPlatformAdminAsync(owner.Email);
        var adminToken = await LoginAsync(client, owner.Email);

        var suspend = await client.SendAsync(Request(
            HttpMethod.Put,
            $"/api/v1/platform/tenants/{tenantId}/status",
            adminToken,
            new { suspended = true, reason = "Commercial review" }));
        Assert.Equal(HttpStatusCode.OK, suspend.StatusCode);

        var blocked = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.Locked, blocked.StatusCode);
        Assert.Equal(
            "WorkspaceSuspended",
            (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errorCode").GetString());

        var reactivate = await client.SendAsync(Request(
            HttpMethod.Put,
            $"/api/v1/platform/tenants/{tenantId}/status",
            adminToken,
            new { suspended = false, reason = "Review completed" }));
        Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);

        var restored = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/students",
            adminToken,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);

        var audit = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/platform/audit?tenantId={tenantId}&take=100",
            adminToken));
        audit.EnsureSuccessStatusCode();
        var auditText = await audit.Content.ReadAsStringAsync();
        Assert.Contains("TenantSuspended", auditText, StringComparison.Ordinal);
        Assert.Contains("TenantReactivated", auditText, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ExistingWorkspaceWithoutSubscription_IsGrandfathered_AndNotLockedOut()
    {
        var client = _factory.CreateClient();
        var owner = await RegisterConfirmLoginAsync(client, "Legacy Owner");
        var tenantId = await CreateTenantAsync(client, owner.Token, "Existing Workspace");

        var stateResponse = await client.SendAsync(Request(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/commercial",
            owner.Token,
            tenantId: tenantId));
        Assert.Equal(HttpStatusCode.OK, stateResponse.StatusCode);
        var state = await stateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(state.GetProperty("isGrandfathered").GetBoolean());
        Assert.Equal("Grandfathered", state.GetProperty("commercialStatus").GetString());
        Assert.Equal(100_000, state.GetProperty("limits").GetProperty("maxStudents").GetInt32());
        Assert.True(state.GetProperty("entitlements").GetProperty("dataExport").GetBoolean());

        var createStudent = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/students",
            owner.Token,
            new { fullName = "Existing Student", grade = "A" },
            tenantId));
        Assert.Equal(HttpStatusCode.Created, createStudent.StatusCode);

        var packagesForbidden = await client.SendAsync(Request(
            HttpMethod.Get,
            "/api/v1/platform/packages",
            owner.Token));
        Assert.Equal(HttpStatusCode.Forbidden, packagesForbidden.StatusCode);
    }

    private async Task<(string Email, string Token)> RegisterConfirmLoginAsync(
        HttpClient client,
        string fullName)
    {
        var email = $"commercial-{Guid.NewGuid():N}@example.test";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "SecurePassword123!",
            fullName
        });
        register.EnsureSuccessStatusCode();

        var confirmation = new Uri(_factory.EmailSender.LastActionUrlFor(
            email,
            EmailKind.Confirmation)!);
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
        var response = await client.SendAsync(Request(
            HttpMethod.Post,
            "/api/v1/tenants",
            token,
            new
            {
                name,
                slug = $"commercial-{Guid.NewGuid():N}"[..30],
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
        int maxStudents,
        int maxMembers,
        string packageName,
        bool dataExport = false,
        bool customBranding = false)
    {
        var code = $"phase4-{Guid.NewGuid():N}"[..30];
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
                        maxStudents,
                        maxMembers,
                        maxClasses = 100,
                        maxActiveAssignments = 500,
                        maxLiveParticipants = 100
                    },
                    entitlements = new
                    {
                        bulkImport = packageName != "Teacher",
                        advancedReports = packageName != "Teacher",
                        certificates = packageName != "Teacher",
                        customBranding,
                        dataExport,
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
        var response = await client.SendAsync(Request(
            HttpMethod.Post,
            $"/api/v1/platform/tenants/{tenantId}/subscriptions/activate",
            adminToken,
            new { planId, changeReason = reason }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
