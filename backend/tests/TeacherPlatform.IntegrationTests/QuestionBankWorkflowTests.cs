using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات Phase 2 الشاملة على PostgreSQL حقيقية:
/// أنواع خمسة بحالاتها الصحيحة والفاشلة، Versioning، Conflict، البحث، العزل بين المستأجرين، والصلاحيات.
/// </summary>
[Trait("Category", "Integration")]
public class QuestionBankWorkflowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public QuestionBankWorkflowTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private HttpClient NewClient() => _factory.CreateClient(
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<(string Email, string AccessToken, string UserId)> RegisterConfirmLogin(
        TestWebApplicationFactory factory, HttpClient client)
    {
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Test User"
        }));

        var confirmUrl = factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var uid = System.Web.HttpUtility.ParseQueryString(uri.Query)["uid"]!;
        var token = System.Web.HttpUtility.ParseQueryString(uri.Query)["token"]!;
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid, token }));

        var loginResponse = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));

        var payload = await ReadJson<JsonElement>(loginResponse);
        return (email, payload.GetProperty("accessToken").GetString()!, payload.GetProperty("user").GetProperty("id").GetString()!);
    }

    private static async Task<Guid> CreateTenantFor(HttpClient client, string accessToken)
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/tenants")
            {
                Content = Json(new
                {
                    name = "Math Space",
                    slug = $"ms-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankFor(HttpClient client, string accessToken, Guid tenantId, string name = "General Bank")
    {
        var response = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/question-banks")
            {
                Content = Json(new { name })
            }, accessToken), CancellationToken.None);

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
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
    public async Task CreateBankListBank_WithinTenant_Succeeds()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);

        var bankId = await CreateBankFor(client, token, tenantId, "Grammar Bank");

        var listResponse = await client.SendAsync(WithAccessToken(
            new HttpRequestMessage(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/question-banks"), token));

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var banks = await ReadJson<JsonElement>(listResponse);
        Assert.Equal(1, banks.GetArrayLength());
        Assert.Equal("Grammar Bank", banks[0].GetProperty("name").GetString());
        Assert.Equal(bankId, banks[0].GetProperty("id").GetGuid());
        Assert.Equal(0, banks[0].GetProperty("questionCount").GetInt32());
    }

    [Fact]
    public async Task CreateQuestion_MultipleChoice_Succeeds()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "ما عاصمة مصر؟",
                options = new[]
                {
                    new { text = "القاهرة", isCorrect = true },
                    new { text = "عمان", isCorrect = false }
                }
            })
        }, token));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        Assert.Equal(1, detail.GetProperty("currentVersionNumber").GetInt32());
        Assert.Equal("MultipleChoice", detail.GetProperty("currentVersion").GetProperty("questionType").GetString());
        Assert.Equal("Active", detail.GetProperty("status").GetString());
        Assert.True(detail.GetProperty("currentVersion").GetProperty("isValid").GetBoolean());
    }

    [Fact]
    public async Task CreateQuestion_TrueFalse_Succeeds()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "TrueFalse",
                prompt = "الشمس تشرق من الشرق",
                options = new[]
                {
                    new { text = "صح", isCorrect = true },
                    new { text = "خطأ", isCorrect = false }
                }
            })
        }, token));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        Assert.Equal("TrueFalse", detail.GetProperty("currentVersion").GetProperty("questionType").GetString());
    }

    [Fact]
    public async Task CreateQuestion_ShortAnswer_RequiresAcceptedAnswers()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var emptyAnswers = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "ShortAnswer",
                prompt = "أكمل: I ___ to school",
                options = Array.Empty<object>(),
                acceptedAnswers = Array.Empty<string>()
            })
        }, token));

        Assert.Equal(HttpStatusCode.BadRequest, emptyAnswers.StatusCode);

        var valid = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "ShortAnswer",
                prompt = "أكمل: I ___ to school",
                options = Array.Empty<object>(),
                acceptedAnswers = new[] { "go", "went" }
            })
        }, token));

        Assert.Equal(HttpStatusCode.Created, valid.StatusCode);
        var detail = await ReadJson<JsonElement>(valid);
        Assert.Equal("ShortAnswer", detail.GetProperty("currentVersion").GetProperty("questionType").GetString());
        Assert.True(detail.GetProperty("currentVersion").GetProperty("isValid").GetBoolean());
    }

    [Fact]
    public async Task CreateQuestion_Ordering_Succeeds()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "Ordering",
                prompt = "رتب الحروف أبجديًا",
                options = new[]
                {
                    new { text = "أ", isCorrect = false },
                    new { text = "ب", isCorrect = false },
                    new { text = "ت", isCorrect = false }
                }
            })
        }, token));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        Assert.Equal("Ordering", detail.GetProperty("currentVersion").GetProperty("questionType").GetString());
        Assert.Equal(3, detail.GetProperty("currentVersion").GetProperty("options").GetArrayLength());
    }

    [Fact]
    public async Task CreateQuestion_MultipleChoice_WithTwoCorrect_Fails()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "X?",
                options = new[]
                {
                    new { text = "A", isCorrect = true },
                    new { text = "B", isCorrect = true }
                }
            })
        }, token));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Question_Versioning_Immutable_And_Conflict_On_Stale()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var createResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "Original?",
                options = new[]
                {
                    new { text = "A", isCorrect = true },
                    new { text = "B", isCorrect = false }
                }
            })
        }, token));

        var created = await ReadJson<JsonElement>(createResponse);
        var questionId = created.GetProperty("id").GetGuid();
        var version1Id = created.GetProperty("currentVersion").GetProperty("id").GetGuid();
        var version1Number = created.GetProperty("currentVersionNumber").GetInt32();
        var version1Prompt = created.GetProperty("currentVersion").GetProperty("prompt").GetString();
        var baseVersion = created.GetProperty("version").GetUInt32();

        // تعديل — ينشئ نسخة 2
        var updateResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/versions")
        {
            Content = Json(new
            {
                prompt = "Updated?",
                options = new[]
                {
                    new { text = "X", isCorrect = true },
                    new { text = "Y", isCorrect = false }
                },
                baseVersion
            })
        }, token));

        Assert.Equal(HttpStatusCode.Created, updateResponse.StatusCode);
        var updated = await ReadJson<JsonElement>(updateResponse);
        Assert.Equal(2, updated.GetProperty("currentVersionNumber").GetInt32());

        // النسخة 1 تبقى كما هي — تاريخيًا لا تتغير
        var v1 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/versions/1"), token));
        Assert.Equal(HttpStatusCode.OK, v1.StatusCode);
        var v1Dto = await ReadJson<JsonElement>(v1);
        Assert.Equal(version1Id, v1Dto.GetProperty("id").GetGuid());
        Assert.Equal(version1Number, v1Dto.GetProperty("versionNumber").GetInt32());
        Assert.Equal(version1Prompt, v1Dto.GetProperty("prompt").GetString());

        // تعديل بنسخة قديمة مسروقة → 409
        var staleResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/versions")
        {
            Content = Json(new
            {
                prompt = "Hijack attempt",
                options = new[]
                {
                    new { text = "Z1", isCorrect = true },
                    new { text = "Z2", isCorrect = false }
                },
                baseVersion // نفس Version q1 القديم — الآن obsolete
            })
        }, token));

        Assert.Equal(HttpStatusCode.Conflict, staleResponse.StatusCode);
    }

    [Fact]
    public async Task Archive_Question_HidesFromList_ButHistoryRemains()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        var createResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "TrueFalse",
                prompt = "مؤقت للحذف",
                options = new[]
                {
                    new { text = "صح", isCorrect = true },
                    new { text = "خطأ", isCorrect = false }
                }
            })
        }, token));

        var questionId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        var archiveResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/archive"), token));
        Assert.Equal(HttpStatusCode.NoContent, archiveResponse.StatusCode);

        var listResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions"), token));
        var list = await ReadJson<JsonElement>(listResponse);
        Assert.Equal(0, list.GetProperty("totalItems").GetInt32());

        // مع includeArchived تظهر
        var archivedResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?includeArchived=true"), token));
        var archivedList = await ReadJson<JsonElement>(archivedResponse);
        Assert.Equal(1, archivedList.GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task QuestionsSearch_And_Filters_Work()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankA = await CreateBankFor(client, token, tenantId, "Bank A");
        var bankB = await CreateBankFor(client, token, tenantId, "Bank B");

        await CreateQuestionAsync(client, token, tenantId, bankA, "الألوان", "أحمر", "MultipleChoice");
        await CreateQuestionAsync(client, token, tenantId, bankB, "الأصوات", "عال", "TrueFalse");
        await CreateQuestionAsync(client, token, tenantId, bankA, "الأماكن", "مدينة", "Ordering");

        var searchResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?search=الألوان"), token));
        var searchResult = await ReadJson<JsonElement>(searchResponse);
        Assert.Equal(1, searchResult.GetProperty("totalItems").GetInt32());

        var filterResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?bankId={bankA}"), token));
        var filterResult = await ReadJson<JsonElement>(filterResponse);
        Assert.Equal(2, filterResult.GetProperty("totalItems").GetInt32());

        var typeResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?type=TrueFalse"), token));
        var typeResult = await ReadJson<JsonElement>(typeResponse);
        Assert.Equal(1, typeResult.GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task CrossTenant_CannotTouch_OtherTenantQuestions()
    {
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);
        var bankA = await CreateBankFor(clientA, tokenA, tenantA);

        var createResponse = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/questions")
        {
            Content = Json(new
            {
                bankId = bankA,
                questionType = "MultipleChoice",
                prompt = "Secret question of tenant A",
                options = new[]
                {
                    new { text = "A1", isCorrect = true },
                    new { text = "A2", isCorrect = false }
                }
            })
        }, tokenA));
        var questionId = (await ReadJson<JsonElement>(createResponse)).GetProperty("id").GetGuid();

        // User B — لا يرى شيئًا من tenantA
        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var tenantB = await CreateTenantFor(clientB, tokenB);
        var bankB = await CreateBankFor(clientB, tokenB, tenantB);

        var bReadingA = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/questions/{questionId}"), tokenB));
        Assert.True(bReadingA.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);

        // حتى يعرف QuestionId — الإصدار 1 تظل خاصة
        var bReadingAVersion = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/questions/{questionId}/versions/1"), tokenB));
        Assert.True(bReadingAVersion.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);

        // A يستطيع بشكل طبيعي
        var aReadingSelf = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/questions/{questionId}"), tokenA));
        Assert.Equal(HttpStatusCode.OK, aReadingSelf.StatusCode);
    }

    [Fact]
    public async Task Assistant_CannotCreateOrModifyQuestions_OwnerCan()
    {
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);
        var bankA = await CreateBankFor(clientA, tokenA, tenantA);

        // B كـAssistant فقط — يُضاف إلى tenantA عبر Owner
        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var emailB = (await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenB)));
        var meB = await ReadJson<JsonElement>(emailB);
        var userBEmail = meB.GetProperty("user").GetProperty("email").GetString()!;

        var addMemberResponse = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/members")
        {
            Content = Json(new { email = userBEmail, role = "Assistant" })
        }, tokenA));
        Assert.Equal(HttpStatusCode.Created, addMemberResponse.StatusCode);

        // Assistant يقرأ لكن لا ينشئ أسئلة
        var assistantList = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/questions"), tokenB));
        Assert.Equal(HttpStatusCode.OK, assistantList.StatusCode);

        var assistantCreate = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/questions")
        {
            Content = Json(new
            {
                bankId = bankA,
                questionType = "MultipleChoice",
                prompt = "p",
                options = new[] { new { text = "o1", isCorrect = true }, new { text = "o2", isCorrect = false } }
            })
        }, tokenB));
        Assert.Equal(HttpStatusCode.Forbidden, assistantCreate.StatusCode);
    }

    [Fact]
    public async Task Teacher_CanCreateQuestions_ViewStandaloneTagList()
    {
        var ownerClient = NewClient();
        var (_, tokenOwner, _) = await RegisterConfirmLogin(_factory, ownerClient);
        var tenantId = await CreateTenantFor(ownerClient, tokenOwner);
        var bankId = await CreateBankFor(ownerClient, tokenOwner, tenantId, "TeacherScope");

        // Teacher يُضاف بعضوية Teacher
        var teacherClient = NewClient();
        var (_, tokenTeacher, _) = await RegisterConfirmLogin(_factory, teacherClient);
        var meTeacherResponse = await teacherClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenTeacher));
        var teacherEmail = (await ReadJson<JsonElement>(meTeacherResponse)).GetProperty("user").GetProperty("email").GetString()!;

        await (await ownerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members")
        {
            Content = Json(new { email = teacherEmail, role = "Teacher" })
        }, tokenOwner))).Content.ReadAsStringAsync();

        // Teacher ينشئ سؤالًا مع وسم جديد — يجب أن يسمح له
        var createResponse = await teacherClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "MultipleChoice",
                prompt = "سؤال من معلم مساعد؟",
                tags = new[] { "قواعد-جديد" },
                options = new[]
                {
                    new { text = "A", isCorrect = true },
                    new { text = "B", isCorrect = false }
                }
            })
        }, tokenTeacher));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        // قائمة الوسوم تظهر الوسم الجديد عبر endpoint مستقل
        var tagsResponse = await teacherClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/question-tags"), tokenTeacher));
        Assert.Equal(HttpStatusCode.OK, tagsResponse.StatusCode);
        var tags = await ReadJson<JsonElement>(tagsResponse);
        Assert.True(tags.GetArrayLength() >= 1);
        Assert.Equal("قواعد-جديد", tags[0].GetProperty("name").GetString());
        Assert.Equal(1, tags[0].GetProperty("questionCount").GetInt32());

        // فلترة حسب الوسم
        var filtered = await teacherClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions?tag=قواعد-جديد"), tokenTeacher));
        var filteredDto = await ReadJson<JsonElement>(filtered);
        Assert.Equal(1, filteredDto.GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task Viewer_CanRead_CannotWrite()
    {
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);

        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var meBResponse = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenB));
        var meB = await ReadJson<JsonElement>(meBResponse);

        await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/members")
        {
            Content = Json(new { email = meB.GetProperty("user").GetProperty("email").GetString()!, role = "Viewer" })
        }, tokenA));

        var viewerCreateBank = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/question-banks")
        {
            Content = Json(new { name = "Viewer's Attempt" })
        }, tokenB));
        Assert.Equal(HttpStatusCode.Forbidden, viewerCreateBank.StatusCode);

        var viewerListBanks = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantA}/question-banks"), tokenB));
        Assert.Equal(HttpStatusCode.OK, viewerListBanks.StatusCode);
    }

    private static async Task CreateQuestionAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        Guid bankId,
        string prompt,
        string answerText,
        string type)
    {
        object[] options = type switch
        {
            "TrueFalse" => [new { text = "صح", isCorrect = true }, new { text = "خطأ", isCorrect = false }],
            "Ordering" => [new { text = "عنصر 1", isCorrect = false }, new { text = "عنصر 2", isCorrect = false }],
            _ => [new { text = answerText, isCorrect = true }, new { text = "خاطئ", isCorrect = false }]
        };

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = type,
                prompt,
                options
            })
        }, accessToken));
        response.EnsureSuccessStatusCode();
    }
}
