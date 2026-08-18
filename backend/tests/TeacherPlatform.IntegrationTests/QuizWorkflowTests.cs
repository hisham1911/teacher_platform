using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// اختبارات Phase 3 الشاملة على PostgreSQL حقيقية:
/// إنشاء اختبار ومسودة، تثبيت نسخ الأسئلة، إعادة الترتيب، التحقق من النشر،
/// النشر الذري، عدم قابلية النسخ المنشورة للتعديل، Checksum حتمي، Idempotency،
/// التزامن، الحدود، الصلاحيات، والعزل بين المستأجرين.
/// </summary>
[Trait("Category", "Integration")]
public class QuizWorkflowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public QuizWorkflowTests(TestWebApplicationFactory factory)
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
                    name = "Quiz Space",
                    slug = $"qz-{Guid.NewGuid():N}"[..20],
                    countryCode = "EG",
                    timezone = "Africa/Cairo",
                    defaultLocale = "ar"
                })
            }, accessToken));

        response.EnsureSuccessStatusCode();
        var payload = await ReadJson<JsonElement>(response);
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankFor(HttpClient client, string accessToken, Guid tenantId, string name = "Quiz Bank")
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

    private static async Task<Guid> CreateQuestionAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid bankId,
        string prompt, string questionType = "MultipleChoice")
    {
        var options = questionType switch
        {
            "TrueFalse" => new object[] { new { text = "صح", isCorrect = true }, new { text = "خطأ", isCorrect = false } },
            "ShortAnswer" => Array.Empty<object>(),
            _ => new object[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } }
        };

        var payload = questionType == "ShortAnswer"
            ? (object)new { bankId, questionType, prompt, options, acceptedAnswers = new[] { "answer" } }
            : new { bankId, questionType, prompt, options };

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(payload)
        }, accessToken));

        response.EnsureSuccessStatusCode();
        var detail = await ReadJson<JsonElement>(response);
        return detail.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateQuizAsync(HttpClient client, string accessToken, Guid tenantId, string title, string slug)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title, slug, description = "وصف تجريبي" })
        }, accessToken));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await ReadJson<JsonElement>(response);
        return detail.GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> GetDraftAsync(HttpClient client, string accessToken, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft"), accessToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> UpdateDraftAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId, uint baseVersion,
        string title = "عنوان محدث", int passingPercentage = 50, string timeMode = "None",
        int? timeLimitSeconds = null)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Put,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft")
        {
            Content = Json(new
            {
                title,
                description = "وصف محدث",
                instructions = "تعليمات",
                passingPercentage,
                timeMode,
                timeLimitSeconds,
                shuffleQuestions = false,
                shuffleOptions = false,
                theme = new { template = "default", primaryColor = "#2563eb", secondaryColor = "#7c3aed", backgroundColor = "#ffffff" },
                baseVersion
            })
        }, accessToken));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> AddItemAsync(
        HttpClient client, string accessToken, Guid tenantId, Guid quizId, Guid questionId, int points = 1)
    {
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points, isRequired = true })
        }, accessToken));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
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

    // ---------- إنشاء ومسودة ----------

    [Fact]
    public async Task CreateQuiz_CreatesDraftV1_Automatically()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);

        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار الرياضيات", "math-quiz-1");

        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal(1, draft.GetProperty("versionNumber").GetInt32());
        Assert.Equal("اختبار الرياضيات", draft.GetProperty("title").GetString());
        Assert.Equal(0, draft.GetProperty("items").GetArrayLength());
        Assert.Equal(0, draft.GetProperty("totalPoints").GetInt32());
        Assert.True(draft.GetProperty("version").GetUInt32() > 0);
    }

    [Fact]
    public async Task UpdateDraft_ChangesFields_AndBumpsVersion()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-update-1");

        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var baseVersion = draft.GetProperty("version").GetUInt32();

        var updated = await UpdateDraftAsync(client, token, tenantId, quizId, baseVersion, "عنوان جديد", 75, "TotalTime", 600);
        Assert.Equal("عنوان جديد", updated.GetProperty("title").GetString());
        Assert.Equal(75, updated.GetProperty("passingPercentage").GetInt32());
        Assert.Equal("TotalTime", updated.GetProperty("timeMode").GetString());
        Assert.Equal(600, updated.GetProperty("timeLimitSeconds").GetInt32());
        Assert.True(updated.GetProperty("version").GetUInt32() > baseVersion);
    }

    // ---------- تثبيت نسخ الأسئلة ----------

    [Fact]
    public async Task AddItem_PinsCurrentQuestionVersion()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال مثبت");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-pin-1");

        var draft = await AddItemAsync(client, token, tenantId, quizId, questionId, 5);
        var item = draft.GetProperty("items")[0];
        Assert.Equal(questionId, item.GetProperty("questionId").GetGuid());
        Assert.Equal(1, item.GetProperty("pinnedVersionNumber").GetInt32());
        Assert.Equal(1, item.GetProperty("latestVersionNumber").GetInt32());
        Assert.Equal(5, item.GetProperty("points").GetInt32());
    }

    [Fact]
    public async Task EditingSourceQuestion_DoesNotChangeDraft_ButShowsNewerVersion()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال قديم");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-pin-2");

        await AddItemAsync(client, token, tenantId, quizId, questionId);

        // تعديل السؤال — ينشئ نسخة 2
        var questionDetail = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}"), token));
        var qDetail = await ReadJson<JsonElement>(questionDetail);
        var qBaseVersion = qDetail.GetProperty("version").GetUInt32();

        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/versions")
        {
            Content = Json(new
            {
                prompt = "سؤال محدث",
                options = new[] { new { text = "X", isCorrect = true }, new { text = "Y", isCorrect = false } },
                baseVersion = qBaseVersion
            })
        }, token));

        // المسودة لا تتغير — لكنها تُظهر أن هناك نسخة أحدث
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var item = draft.GetProperty("items")[0];
        Assert.Equal(1, item.GetProperty("pinnedVersionNumber").GetInt32());
        Assert.Equal(2, item.GetProperty("latestVersionNumber").GetInt32());
        Assert.Equal("سؤال قديم", item.GetProperty("prompt").GetString()); // المثبت لا يتغير
    }

    // ---------- إعادة الترتيب ----------

    [Fact]
    public async Task ReorderItems_ProducesUniqueSortOrder()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var q1 = await CreateQuestionAsync(client, token, tenantId, bankId, "س1");
        var q2 = await CreateQuestionAsync(client, token, tenantId, bankId, "س2");
        var q3 = await CreateQuestionAsync(client, token, tenantId, bankId, "س3");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-reorder-1");

        await AddItemAsync(client, token, tenantId, quizId, q1);
        await AddItemAsync(client, token, tenantId, quizId, q2);
        var draft = await AddItemAsync(client, token, tenantId, quizId, q3);

        var items = draft.GetProperty("items").EnumerateArray().ToList();
        var ids = items.Select(i => i.GetProperty("id").GetGuid()).ToList();

        // عكس الترتيب
        var reversed = ids.AsEnumerable().Reverse().ToArray();
        var reorderResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Put,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/order")
        {
            Content = Json(new { orderedItemIds = reversed })
        }, token));

        Assert.Equal(HttpStatusCode.OK, reorderResponse.StatusCode);
        var reordered = await ReadJson<JsonElement>(reorderResponse);
        var sortOrders = reordered.GetProperty("items").EnumerateArray()
            .Select(i => i.GetProperty("sortOrder").GetInt32()).ToList();
        Assert.Equal(sortOrders.Count, sortOrders.Distinct().Count()); // لا تكرار
        Assert.Equal(reordered.GetProperty("items")[0].GetProperty("id").GetGuid(), reversed[0]);
    }

    // ---------- التحقق من الصحة ----------

    [Fact]
    public async Task AddItem_InvalidPoints_Returns400()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-points-1");

        var zeroPoints = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points = 0, isRequired = true })
        }, token));
        Assert.Equal(HttpStatusCode.BadRequest, zeroPoints.StatusCode);

        var tooMany = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points = 1001, isRequired = true })
        }, token));
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
    }

    [Fact]
    public async Task Publish_EmptyQuiz_Returns400()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار فارغ", "quiz-empty-1");

        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var baseVersion = draft.GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion })
        }, token));

        Assert.Equal(HttpStatusCode.BadRequest, publishResponse.StatusCode);
        var error = await ReadJson<JsonElement>(publishResponse);
        Assert.Equal("QuizEmpty", error.GetProperty("title").GetString());
    }

    [Fact]
    public async Task AddItem_ArchivedQuestion_Returns404()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال للأرشفة");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-arch-1");

        // أرشفة السؤال
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/archive"), token));

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points = 1, isRequired = true })
        }, token));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Publish_ListeningWithoutAudio_Returns400()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);

        // إنشاء سؤال Listening بدون وسائط — غير صالح
        var listeningResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions")
        {
            Content = Json(new
            {
                bankId,
                questionType = "Listening",
                prompt = "استمع وأجب",
                options = new[] { new { text = "أ", isCorrect = true }, new { text = "ب", isCorrect = false } }
            })
        }, token));

        // قد يفشل الإنشاء أصلًا إذا كان الخادم يتحقق — نتحقق من الحالتين
        if (listeningResponse.StatusCode == HttpStatusCode.Created)
        {
            var questionId = (await ReadJson<JsonElement>(listeningResponse)).GetProperty("id").GetGuid();
            var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار استماع", "quiz-listen-1");
            await AddItemAsync(client, token, tenantId, quizId, questionId);

            var draft = await GetDraftAsync(client, token, tenantId, quizId);
            var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
            {
                Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() })
            }, token));

            Assert.Equal(HttpStatusCode.BadRequest, publishResponse.StatusCode);
            var error = await ReadJson<JsonElement>(publishResponse);
            Assert.Equal("QuizInvalid", error.GetProperty("title").GetString());
            Assert.Contains("ListeningRequiresAudio", error.GetProperty("detail").GetString());
        }
        else
        {
            // الخادم يرفض إنشاء Listening بدون صوت أصلًا — هذا أيضًا سلوك صحيح
            Assert.Equal(HttpStatusCode.BadRequest, listeningResponse.StatusCode);
        }
    }

    // ---------- العزل بين المستأجرين ----------

    [Fact]
    public async Task CrossTenant_CannotInject_OtherTenantQuestion()
    {
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);
        var bankA = await CreateBankFor(clientA, tokenA, tenantA);
        var questionA = await CreateQuestionAsync(clientA, tokenA, tenantA, bankA, "سؤال سري");

        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var tenantB = await CreateTenantFor(clientB, tokenB);
        var quizB = await CreateQuizAsync(clientB, tokenB, tenantB, "اختبار B", "quiz-cross-1");

        // B يحاول إضافة سؤال A — يجب أن يفشل (Global Filters تخفيه)
        var response = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantB}/quizzes/{quizB}/draft/items")
        {
            Content = Json(new { questionId = questionA, points = 1, isRequired = true })
        }, tokenB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------- الصلاحيات ----------

    [Fact]
    public async Task Assistant_AndViewer_CannotWriteTeacherContent()
    {
        var ownerClient = NewClient();
        var (_, tokenOwner, _) = await RegisterConfirmLogin(_factory, ownerClient);
        var tenantId = await CreateTenantFor(ownerClient, tokenOwner);
        var bankId = await CreateBankFor(ownerClient, tokenOwner, tenantId);
        var questionId = await CreateQuestionAsync(ownerClient, tokenOwner, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(ownerClient, tokenOwner, tenantId, "اختبار", "quiz-perm-1");

        // Assistant
        var assistantClient = NewClient();
        var (_, tokenAssistant, _) = await RegisterConfirmLogin(_factory, assistantClient);
        var meAssistant = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenAssistant));
        var assistantEmail = (await ReadJson<JsonElement>(meAssistant)).GetProperty("user").GetProperty("email").GetString()!;
        await ownerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members")
        {
            Content = Json(new { email = assistantEmail, role = "Assistant" })
        }, tokenOwner));

        // Viewer
        var viewerClient = NewClient();
        var (_, tokenViewer, _) = await RegisterConfirmLogin(_factory, viewerClient);
        var meViewer = await viewerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenViewer));
        var viewerEmail = (await ReadJson<JsonElement>(meViewer)).GetProperty("user").GetProperty("email").GetString()!;
        await ownerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members")
        {
            Content = Json(new { email = viewerEmail, role = "Viewer" })
        }, tokenOwner));

        // Assistant يقرأ لكن لا يكتب
        var assistantRead = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes"), tokenAssistant));
        Assert.Equal(HttpStatusCode.OK, assistantRead.StatusCode);

        var assistantCreate = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "x", slug = "x-1" })
        }, tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantCreate.StatusCode);

        var assistantAddItem = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items")
        {
            Content = Json(new { questionId, points = 1, isRequired = true })
        }, tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantAddItem.StatusCode);

        using var mediaContent = new MultipartFormDataContent();
        mediaContent.Add(new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), "file", "image.png");
        var assistantMediaUpload = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/media")
        {
            Content = mediaContent
        }, tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantMediaUpload.StatusCode);

        var assistantSurveyCreate = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/surveys")
        {
            Content = Json(new { quizId, title = "x", questions = Array.Empty<object>() })
        }, tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantSurveyCreate.StatusCode);

        var assistantTemplateCreate = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/certificate-templates")
        {
            Content = Json(new
            {
                name = "x",
                titleText = "x",
                bodyText = "x",
                issuerName = "x",
                primaryColor = "#0F766E",
                secondaryColor = "#D97706",
                isDefault = false
            })
        }, tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantTemplateCreate.StatusCode);

        var assistantCertificateRetry = await assistantClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/certificates/{Guid.NewGuid()}/retry"), tokenAssistant));
        Assert.Equal(HttpStatusCode.Forbidden, assistantCertificateRetry.StatusCode);

        // Viewer لا يكتب
        var viewerCreate = await viewerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes")
        {
            Content = Json(new { title = "x", slug = "x-2" })
        }, tokenViewer));
        Assert.Equal(HttpStatusCode.Forbidden, viewerCreate.StatusCode);
    }

    [Fact]
    public async Task Teacher_CanWriteQuizzes()
    {
        var ownerClient = NewClient();
        var (_, tokenOwner, _) = await RegisterConfirmLogin(_factory, ownerClient);
        var tenantId = await CreateTenantFor(ownerClient, tokenOwner);
        var bankId = await CreateBankFor(ownerClient, tokenOwner, tenantId);
        var questionId = await CreateQuestionAsync(ownerClient, tokenOwner, tenantId, bankId, "سؤال");

        var teacherClient = NewClient();
        var (_, tokenTeacher, _) = await RegisterConfirmLogin(_factory, teacherClient);
        var meTeacher = await teacherClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me"), tokenTeacher));
        var teacherEmail = (await ReadJson<JsonElement>(meTeacher)).GetProperty("user").GetProperty("email").GetString()!;
        await ownerClient.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/members")
        {
            Content = Json(new { email = teacherEmail, role = "Teacher" })
        }, tokenOwner));

        var quizId = await CreateQuizAsync(teacherClient, tokenTeacher, tenantId, "اختبار المعلم", "quiz-teacher-1");
        var draft = await AddItemAsync(teacherClient, tokenTeacher, tenantId, quizId, questionId);
        Assert.Single(draft.GetProperty("items").EnumerateArray());
    }

    // ---------- النشر ----------

    [Fact]
    public async Task Publish_Succeeds_AndCreatesNewDraft()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال النشر");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار النشر", "quiz-pub-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId, 10);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var baseVersion = draft.GetProperty("version").GetUInt32();

        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion })
        }, token));

        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);
        var published = await ReadJson<JsonElement>(publishResponse);
        Assert.Equal(1, published.GetProperty("versionNumber").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(published.GetProperty("checksum").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(published.GetProperty("publicCode").GetString()));
        Assert.Contains("/q/", published.GetProperty("shareUrl").GetString());

        // مسودة جديدة v2 تُنشأ تلقائيًا
        var newDraft = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal(2, newDraft.GetProperty("versionNumber").GetInt32());
        Assert.Single(newDraft.GetProperty("items").EnumerateArray()); // العناصر تُنسخ
    }

    [Fact]
    public async Task PublicationState_TracksNeverPublished_Current_AndItemChanges()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال دورة النشر");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار دورة النشر", "quiz-publication-state");

        var initialDraft = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("NeverPublished", initialDraft.GetProperty("publicationState").GetString());

        var readyDraft = await AddItemAsync(client, token, tenantId, quizId, questionId, 5);
        var firstPublish = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = readyDraft.GetProperty("version").GetUInt32() })
        }, token));
        Assert.Equal(HttpStatusCode.OK, firstPublish.StatusCode);

        var currentDraft = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("PublishedCurrent", currentDraft.GetProperty("publicationState").GetString());

        var itemId = currentDraft.GetProperty("items")[0].GetProperty("id").GetGuid();
        var updateItem = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Patch,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}")
        {
            Content = Json(new { points = 7, isRequired = true })
        }, token));
        Assert.Equal(HttpStatusCode.OK, updateItem.StatusCode);
        var changedDraft = await ReadJson<JsonElement>(updateItem);
        Assert.Equal("PublishedWithChanges", changedDraft.GetProperty("publicationState").GetString());

        var updatePublish = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = changedDraft.GetProperty("version").GetUInt32() })
        }, token));
        Assert.Equal(HttpStatusCode.OK, updatePublish.StatusCode);

        var republishedDraft = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("PublishedCurrent", republishedDraft.GetProperty("publicationState").GetString());
    }

    [Fact]
    public async Task PublishedVersion_IsImmutable()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال ثابت");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-immut-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() })
        }, token));

        // قراءة النسخة المنشورة
        var versionResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/versions/1"), token));
        Assert.Equal(HttpStatusCode.OK, versionResponse.StatusCode);
        var v1 = await ReadJson<JsonElement>(versionResponse);
        var v1Title = v1.GetProperty("title").GetString();
        var v1Checksum = v1.GetProperty("checksum").GetString();

        // تعديل المسودة الجديدة لا يؤثر على المنشورة
        var newDraft = await GetDraftAsync(client, token, tenantId, quizId);
        await UpdateDraftAsync(client, token, tenantId, quizId, newDraft.GetProperty("version").GetUInt32(), "عنوان مختلف تمامًا");

        var v1Again = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/versions/1"), token));
        var v1After = await ReadJson<JsonElement>(v1Again);
        Assert.Equal(v1Title, v1After.GetProperty("title").GetString());
        Assert.Equal(v1Checksum, v1After.GetProperty("checksum").GetString());
    }

    [Fact]
    public async Task RePublish_RetiresOldPublished()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-repub-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId);

        // نشر أول
        var draft1 = await GetDraftAsync(client, token, tenantId, quizId);
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = draft1.GetProperty("version").GetUInt32() })
        }, token));

        // تعديل ونشر ثانٍ
        var draft2 = await GetDraftAsync(client, token, tenantId, quizId);
        var updated = await UpdateDraftAsync(client, token, tenantId, quizId, draft2.GetProperty("version").GetUInt32(), "نسخة ثانية");
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        {
            Content = Json(new { baseVersion = updated.GetProperty("version").GetUInt32() })
        }, token));

        // النسخة 1 أصبحت Retired والنسخة 2 منشورة — نقرأ الحالة من قائمة النسخ
        var listResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/versions"), token));
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var versions = await ReadJson<JsonElement>(listResponse);

        var v1Summary = versions.EnumerateArray().Single(v => v.GetProperty("versionNumber").GetInt32() == 1);
        Assert.Equal("Retired", v1Summary.GetProperty("status").GetString());

        var v2Summary = versions.EnumerateArray().Single(v => v.GetProperty("versionNumber").GetInt32() == 2);
        Assert.Equal("Published", v2Summary.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Checksum_IsDeterministic_AndChangesWithContent()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");

        // اختباران بنفس المحتوى تمامًا → نفس Checksum
        var quiz1 = await CreateQuizAsync(client, token, tenantId, "اختبار أ", "quiz-cs-1");
        var quiz2 = await CreateQuizAsync(client, token, tenantId, "اختبار أ", "quiz-cs-2");
        await AddItemAsync(client, token, tenantId, quiz1, questionId, 5);
        await AddItemAsync(client, token, tenantId, quiz2, questionId, 5);

        var d1 = await GetDraftAsync(client, token, tenantId, quiz1);
        var d2 = await GetDraftAsync(client, token, tenantId, quiz2);

        var p1 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quiz1}/publish")
        { Content = Json(new { baseVersion = d1.GetProperty("version").GetUInt32() }) }, token));
        var p2 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quiz2}/publish")
        { Content = Json(new { baseVersion = d2.GetProperty("version").GetUInt32() }) }, token));

        var checksum1 = (await ReadJson<JsonElement>(p1)).GetProperty("checksum").GetString();
        var checksum2 = (await ReadJson<JsonElement>(p2)).GetProperty("checksum").GetString();
        Assert.Equal(checksum1, checksum2); // حتمي

        // تغيير المحتوى يغير Checksum
        var draft3 = await GetDraftAsync(client, token, tenantId, quiz1);
        var updated = await UpdateDraftAsync(client, token, tenantId, quiz1, draft3.GetProperty("version").GetUInt32(), "عنوان مختلف");
        var p3 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quiz1}/publish")
        { Content = Json(new { baseVersion = updated.GetProperty("version").GetUInt32() }) }, token));
        var checksum3 = (await ReadJson<JsonElement>(p3)).GetProperty("checksum").GetString();
        Assert.NotEqual(checksum1, checksum3);
    }

    [Fact]
    public async Task DuplicatePublish_IsIdempotent()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-idem-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var baseVersion = draft.GetProperty("version").GetUInt32();

        var p1 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        { Content = Json(new { baseVersion }) }, token));
        Assert.Equal(HttpStatusCode.OK, p1.StatusCode);
        var first = await ReadJson<JsonElement>(p1);

        // إعادة إرسال نفس طلب النشر (نفس baseVersion القديم) — يجب ألا يُنشئ نسخة جديدة.
        // الخدمة ترفض بأمان بـ 409 لأن baseVersion أصبح قديمًا بعد إنشاء مسودة v2.
        var p2 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        { Content = Json(new { baseVersion }) }, token));
        Assert.Equal(HttpStatusCode.Conflict, p2.StatusCode);

        // لا توجد نسخة 3 — الحالة مستقرة: v1 منشورة + v2 مسودة فقط
        var versions = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/versions"), token));
        var versionList = await ReadJson<JsonElement>(versions);
        Assert.Equal(2, versionList.GetArrayLength());

        // النسخة المنشورة ما زالت v1 بنفس المعرف
        var publishedSummary = versionList.EnumerateArray().Single(v => v.GetProperty("status").GetString() == "Published");
        Assert.Equal(first.GetProperty("publishedVersionId").GetGuid(), publishedSummary.GetProperty("id").GetGuid());
        Assert.Equal(1, publishedSummary.GetProperty("versionNumber").GetInt32());
    }

    [Fact]
    public async Task Publish_StaleBaseVersion_Returns409()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", "quiz-conflict-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var staleVersion = draft.GetProperty("version").GetUInt32();

        // تعديل يغير النسخة
        await UpdateDraftAsync(client, token, tenantId, quizId, staleVersion, "تعديل");

        // نشر بالنسخة القديمة → 409
        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        { Content = Json(new { baseVersion = staleVersion }) }, token));

        Assert.Equal(HttpStatusCode.Conflict, publishResponse.StatusCode);
    }

    // ---------- الأرشفة ----------

    [Fact]
    public async Task Archive_KeepsVersionsAccessible()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار للأرشفة", "quiz-arch-keep-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        { Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() }) }, token));

        // أرشفة
        var archiveResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/archive"), token));
        Assert.Equal(HttpStatusCode.NoContent, archiveResponse.StatusCode);

        // النسخ تبقى قابلة للقراءة
        var v1 = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/versions/1"), token));
        Assert.Equal(HttpStatusCode.OK, v1.StatusCode);
    }

    // ---------- المشاركة العامة ----------

    [Fact]
    public async Task PublicQuizPage_ReturnsMetadata_WithoutQuestions()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال سري");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار عام", "quiz-public-1");

        await AddItemAsync(client, token, tenantId, quizId, questionId, 7);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);
        var publishResponse = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish")
        { Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() }) }, token));
        var published = await ReadJson<JsonElement>(publishResponse);
        var publicCode = published.GetProperty("publicCode").GetString();

        // وصول مجهول
        var anonymousClient = NewClient();
        var publicResponse = await anonymousClient.GetAsync($"/api/v1/public/quizzes/{publicCode}");
        Assert.Equal(HttpStatusCode.OK, publicResponse.StatusCode);
        var publicPage = await ReadJson<JsonElement>(publicResponse);

        Assert.Equal("اختبار عام", publicPage.GetProperty("title").GetString());
        Assert.Equal(1, publicPage.GetProperty("questionCount").GetInt32());
        Assert.Equal(7, publicPage.GetProperty("totalPoints").GetInt32());
        Assert.True(publicPage.GetProperty("available").GetBoolean());

        // لا توجد أسئلة أو إجابات
        Assert.False(publicPage.TryGetProperty("items", out _));
        Assert.False(publicPage.TryGetProperty("questions", out _));
    }

    // ---------- GAP-C: استخدام أحدث نسخة من السؤال ----------

    [Fact]
    public async Task UseLatestVersion_PinsNewerQuestionVersion()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال قديم");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);

        var draft = await AddItemAsync(client, token, tenantId, quizId, questionId);
        var itemId = draft.GetProperty("items")[0].GetProperty("id").GetGuid();

        // تعديل السؤال — ينشئ نسخة 2
        var questionDetail = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}"), token));
        var qBaseVersion = (await ReadJson<JsonElement>(questionDetail)).GetProperty("version").GetUInt32();
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/versions")
        {
            Content = Json(new
            {
                prompt = "سؤال محدث",
                options = new[] { new { text = "X", isCorrect = true }, new { text = "Y", isCorrect = false } },
                baseVersion = qBaseVersion
            })
        }, token));

        // استخدام أحدث نسخة
        var currentDraft = await GetDraftAsync(client, token, tenantId, quizId);
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}/use-latest-version")
        {
            Content = Json(new { baseVersion = currentDraft.GetProperty("version").GetUInt32() })
        }, token));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadJson<JsonElement>(response);
        var item = updated.GetProperty("items")[0];
        Assert.Equal(2, item.GetProperty("pinnedVersionNumber").GetInt32());
        Assert.Equal(2, item.GetProperty("latestVersionNumber").GetInt32());
        Assert.Equal("سؤال محدث", item.GetProperty("prompt").GetString());
    }

    [Fact]
    public async Task UseLatestVersion_StaleBaseVersion_Returns409()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);

        var draft = await AddItemAsync(client, token, tenantId, quizId, questionId);
        var itemId = draft.GetProperty("items")[0].GetProperty("id").GetGuid();

        // BaseVersion خاطئ (قديم)
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}/use-latest-version")
        {
            Content = Json(new { baseVersion = 999u })
        }, token));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UseLatestVersion_WrongItem_Returns404()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);

        await AddItemAsync(client, token, tenantId, quizId, questionId);
        var draft = await GetDraftAsync(client, token, tenantId, quizId);

        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{Guid.NewGuid()}/use-latest-version")
        {
            Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() })
        }, token));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UseLatestVersion_ArchivedSourceQuestion_Returns404()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال للأرشفة");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);

        var draft = await AddItemAsync(client, token, tenantId, quizId, questionId);
        var itemId = draft.GetProperty("items")[0].GetProperty("id").GetGuid();

        // أرشفة السؤال المصدر
        await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/questions/{questionId}/archive"), token));

        var currentDraft = await GetDraftAsync(client, token, tenantId, quizId);
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}/use-latest-version")
        {
            Content = Json(new { baseVersion = currentDraft.GetProperty("version").GetUInt32() })
        }, token));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UseLatestVersion_AlreadyLatest_IsIdempotent()
    {
        var client = NewClient();
        var (_, token, _) = await RegisterConfirmLogin(_factory, client);
        var tenantId = await CreateTenantFor(client, token);
        var bankId = await CreateBankFor(client, token, tenantId);
        var questionId = await CreateQuestionAsync(client, token, tenantId, bankId, "سؤال");
        var quizId = await CreateQuizAsync(client, token, tenantId, "اختبار", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);

        var draft = await AddItemAsync(client, token, tenantId, quizId, questionId);
        var itemId = draft.GetProperty("items")[0].GetProperty("id").GetGuid();

        // السؤال بالفعل على أحدث نسخة (v1) — يجب أن ينجح بدون تغيير
        var response = await client.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}/use-latest-version")
        {
            Content = Json(new { baseVersion = draft.GetProperty("version").GetUInt32() })
        }, token));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await ReadJson<JsonElement>(response);
        Assert.Equal(1, result.GetProperty("items")[0].GetProperty("pinnedVersionNumber").GetInt32());
    }

    [Fact]
    public async Task UseLatestVersion_CrossTenant_Returns404()
    {
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);
        var bankA = await CreateBankFor(clientA, tokenA, tenantA);
        var questionA = await CreateQuestionAsync(clientA, tokenA, tenantA, bankA, "سؤال A");
        var quizA = await CreateQuizAsync(clientA, tokenA, tenantA, "اختبار A", $"quiz-gapc-{Guid.NewGuid():N}"[..20]);
        var draftA = await AddItemAsync(clientA, tokenA, tenantA, quizA, questionA);
        var itemA = draftA.GetProperty("items")[0].GetProperty("id").GetGuid();

        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var tenantB = await CreateTenantFor(clientB, tokenB);

        // B يحاول الوصول لعنصر في اختبار A — يجب أن يفشل
        var response = await clientB.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantB}/quizzes/{quizA}/draft/items/{itemA}/use-latest-version")
        {
            Content = Json(new { baseVersion = 1u })
        }, tokenB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------- GAP-D: عزل حدود الاستخدام بين المستأجرين ----------

    [Fact]
    public async Task QuizLimits_AreIsolatedPerTenant()
    {
        // MaxQuizzesPerTenant = 2 في بيئة Testing
        var clientA = NewClient();
        var (_, tokenA, _) = await RegisterConfirmLogin(_factory, clientA);
        var tenantA = await CreateTenantFor(clientA, tokenA);

        // المستأجر A يملأ حصته (2 اختبار)
        await CreateQuizAsync(clientA, tokenA, tenantA, "اختبار 1", $"qa-{Guid.NewGuid():N}"[..20]);
        await CreateQuizAsync(clientA, tokenA, tenantA, "اختبار 2", $"qa-{Guid.NewGuid():N}"[..20]);

        // الثالث يجب أن يفشل بـ QuotaExceeded
        var thirdResponse = await clientA.SendAsync(WithAccessToken(new HttpRequestMessage(HttpMethod.Post,
            $"/api/v1/tenants/{tenantA}/quizzes")
        {
            Content = Json(new { title = "اختبار 3", slug = $"qa-{Guid.NewGuid():N}"[..20] })
        }, tokenA));
        Assert.Equal(HttpStatusCode.Forbidden, thirdResponse.StatusCode);

        // المستأجر B لا يتأثر — يمكنه الإنشاء
        var clientB = NewClient();
        var (_, tokenB, _) = await RegisterConfirmLogin(_factory, clientB);
        var tenantB = await CreateTenantFor(clientB, tokenB);
        var bQuiz = await CreateQuizAsync(clientB, tokenB, tenantB, "اختبار B", $"qb-{Guid.NewGuid():N}"[..20]);
        Assert.NotEqual(Guid.Empty, bQuiz);
    }
}
