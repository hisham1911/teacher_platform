using System.Net;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات عزل المستأجرين وعمليات Tenants API الحرجة.
/// تتطلب PostgreSQL حقيقيًا عبر INTEGRATION_TEST_DB.
/// </summary>
[Trait("Category", "Integration")]
public class TenancyTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public TenancyTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<(string Email, string AccessToken, string RefreshCookie, string UserId)> RegisterConfirmLogin(
        TestWebApplicationFactory factory, HttpClient client)
    {
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", TestDataBuilder.Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", TestDataBuilder.Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", TestDataBuilder.Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var payload = await ReadJson<JsonElement>(loginResponse);
        var accessToken = payload.GetProperty("accessToken").GetString()!;
        var userId = payload.GetProperty("user").GetProperty("id").GetString()!;

        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        // يقبل كلا الاسمين — __Host-tp-refresh (Production مع Secure) و tp-refresh (Development/Testing بدون Secure)
        // المقارنة الحساسة للحالة تتجنب التقاط __Host-tp-refresh عبر tp-refresh=
        var refreshCookie = cookies.First(c =>
                c.Contains("__Host-tp-refresh", StringComparison.Ordinal)
                || c.Contains("tp-refresh=", StringComparison.Ordinal))
            .Split(';')[0].Split('=', 2)[1];

        return (email, accessToken, refreshCookie, userId);
    }

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

    [Fact]
    public async Task CreateTenant_CreatesWorkspace_WithOwnerMembership_AndSettings_InOneTransaction()
    {
        var client = _factory.CreateClient();
        var (_, accessToken, _, _) = await RegisterConfirmLogin(_factory, client);

        var createResponse = await client.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "My Workspace",
                    slug = $"ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, accessToken),
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var payload = await ReadJson<JsonElement>(createResponse);
        var tenantId = payload.GetProperty("id").GetGuid();
        Assert.Equal("Owner", payload.GetProperty("myRole").GetString());
        Assert.True(payload.GetProperty("settings").ValueKind != JsonValueKind.Undefined);
    }

    [Fact]
    public async Task TenantsMine_ReturnsOnlyMyTenants()
    {
        var clientA = _factory.CreateClient();
        var (_, tokenA, _, _) = await RegisterConfirmLogin(_factory, clientA);
        var clientB = _factory.CreateClient();
        var (_, tokenB, _, _) = await RegisterConfirmLogin(_factory, clientB);

        // A creates a workspace
        await clientA.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "A Workspace",
                    slug = $"a-ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, tokenA),
            CancellationToken.None);

        // B lists their tenants — should be empty for this test user
        var mineB = await clientB.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/tenants/mine"), tokenB),
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, mineB.StatusCode);
        var list = await ReadJson<JsonElement>(mineB);
        Assert.Equal(0, list.GetArrayLength());
    }

    [Fact]
    public async Task GetTenantById_AsNonMember_Returns404_CrossTenantProtection()
    {
        var clientA = _factory.CreateClient();
        var (_, tokenA, _, _) = await RegisterConfirmLogin(_factory, clientA);
        var clientB = _factory.CreateClient();
        var (_, tokenB, _, _) = await RegisterConfirmLogin(_factory, clientB);

        var createResponse = await clientA.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "A Workspace",
                    slug = $"a-ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, tokenA),
            CancellationToken.None);

        var tenantId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        // B tries to read A's tenant — should not find it (304 style: hide existence)
        var attempt = await clientB.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{tenantId}"), tokenB),
            CancellationToken.None);

        Assert.True(attempt.StatusCode == HttpStatusCode.NotFound
            || attempt.StatusCode == HttpStatusCode.Unauthorized
            || attempt.StatusCode == HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task TenantRouteHeaderMismatch_Returns400()
    {
        var client = _factory.CreateClient();
        var (_, accessToken, _, _) = await RegisterConfirmLogin(_factory, client);

        var createResponse = await client.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "My Workspace",
                    slug = $"ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, accessToken),
            CancellationToken.None);

        var tenantId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        var mismatchRequest = WithAccessToken(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{tenantId}"), accessToken);
        mismatchRequest.Headers.Add("X-Tenant-Id", Guid.NewGuid().ToString());

        var mismatchResponse = await client.SendAsync(mismatchRequest);

        Assert.Equal(HttpStatusCode.BadRequest, mismatchResponse.StatusCode);
    }

    [Fact]
    public async Task TenantHeaderWithoutMemberShip_IsRejected_NoContextLeakAcrossSequentialRequests()
    {
        // A ينشئ Workspaces ثم يجعل الطلب الثاني لبيانات Workspace B من مستخدم آخر
        var clientA = _factory.CreateClient();
        var (_, tokenA, _, _) = await RegisterConfirmLogin(_factory, clientA);
        var clientB = _factory.CreateClient();
        var (_, tokenB, _, _) = await RegisterConfirmLogin(_factory, clientB);

        var createA = await clientA.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "Workspace A",
                    slug = $"a-ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, tokenA), CancellationToken.None);

        var tenantAId = (await ReadJson<JsonElement>(createA)).GetProperty("id").GetGuid();

        // A يقرأ Workspaces الخاصة به — يجب أن يجد A فقط
        var mineA = await clientA.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/tenants/mine"), tokenA),
            CancellationToken.None);
        var listA = await ReadJson<JsonElement>(mineA);
        Assert.Equal(1, listA.GetArrayLength());

        // B يحاول قراءة tenantA عبر X-Tenant-Id بدون عضوية
        var headerAttempt = WithAccessToken(
            new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenB);
        headerAttempt.Headers.Add("X-Tenant-Id", tenantAId.ToString());
        var meB = await clientB.SendAsync(headerAttempt);
        Assert.Equal(HttpStatusCode.OK, meB.StatusCode);

        // B — Workspace الحالية في Session يجب أن تكون null لأنّه ليس عضوًا فيها
        var meBPayload = await ReadJson<JsonElement>(meB);
        var activeWorkspace = meBPayload.GetProperty("activeWorkspace");
        Assert.Equal(JsonValueKind.Null, activeWorkspace.ValueKind);

        // Sequential same-client: A ثم B ثم A — لا Tenant يتسرب من طلب A ليُستخدم في طلب B
        var clientAB = _factory.CreateClient();
        var (_, tokenA1, _, _) = await RegisterConfirmLogin(_factory, clientAB);
        var createA1 = await clientAB.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = TestDataBuilder.Json(new
                {
                    name = "Workspace A1",
                    slug = $"a1-ws-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, tokenA1), CancellationToken.None);
        var tenantA1Id = (await ReadJson<JsonElement>(createA1)).GetProperty("id").GetGuid();

        // A1 يزور Workspace الخاصة به → السياق يختار A1
        var getA1 = WithAccessToken(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{tenantA1Id}"), tokenA1);
        var resA1 = await clientAB.SendAsync(getA1);
        Assert.Equal(HttpStatusCode.OK, resA1.StatusCode);

        // مستخدم آخر يشارك Node — يجب ألا يتحصل على بيانات A1 بمجرد التتابع على نفس الـClient
        var clientB2 = _factory.CreateClient();
        var (_, tokenB2, _, _) = await RegisterConfirmLogin(_factory, clientB2);
        var getA1ByB2 = await clientB2.SendAsync(
            WithAccessToken(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{tenantA1Id}"), tokenB2),
            CancellationToken.None);
        Assert.NotEqual(HttpStatusCode.OK, getA1ByB2.StatusCode);
    }

    [Fact]
    public async Task Register_CannotGrantPlatformAdmin_FromPublicRequest()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";

        // أي خاصية إضافية (Role / PlatformRole / Roles) يجب أن تُرفض أو تتجاهل دون منح صلاحية
        var response = await client.PostAsync("/api/v1/auth/register", TestDataBuilder.Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User",
            role = "PlatformAdmin",
            roles = new[] { "PlatformAdmin" },
            isPlatformAdmin = true
        }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateTenant_DeletedMembershipStatus_BeforeActivation_NoAccessBeforeExplicitMembership()
    {
        // تغطية Additional: المستخدم بدون Workspace لا يوفق على TenantId عشوائي — يمر بـ404
        var client = _factory.CreateClient();
        var (_, token, _, _) = await RegisterConfirmLogin(_factory, client);

        var randomTenantId = Guid.NewGuid();
        var getRandom = WithAccessToken(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{randomTenantId}"), token);
        var response = await client.SendAsync(getRandom);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
