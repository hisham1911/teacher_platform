using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Live;
using TeacherPlatform.IntegrationTests.Infrastructure;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class LiveCompetitionTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private const string GuestCookieName = "tp-guest";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    private readonly TestWebApplicationFactory _factory;

    public LiveCompetitionTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task LiveFlow_MasksScoringUntilClose_ThenFinalizesServerSide()
    {
        var teacher = NewClient();
        var setup = await CreateLiveSetupAsync(teacher, "live-rest");
        var player = NewClient();
        var guestToken = await JoinAsync(player, setup.JoinCode, "لاعب مباشر");
        var attempt = await StartAttemptAsync(player, setup.JoinCode, guestToken);
        var attemptId = attempt.GetProperty("attemptId").GetGuid();

        var publicInfo = await ReadJson<JsonElement>(await player.GetAsync(
            $"/api/v1/player/sessions/{setup.JoinCode}"));
        Assert.Equal("Live", publicInfo.GetProperty("mode").GetString());

        var beforeOpen = await player.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{attemptId}/current-question",
            guestToken));
        Assert.Equal(HttpStatusCode.Conflict, beforeOpen.StatusCode);

        var opened = await ControlAsync(teacher, setup, "questions/open-next", 0, setup.AccessToken);
        Assert.Equal("QuestionOpen", opened.GetProperty("phase").GetString());
        Assert.DoesNotContain("isCorrect", opened.GetRawText(), StringComparison.OrdinalIgnoreCase);

        var question = await GetCurrentQuestionAsync(player, setup.JoinCode, attemptId, guestToken);
        Assert.DoesNotContain("isCorrect", question.GetRawText(), StringComparison.OrdinalIgnoreCase);
        var correctOption = question.GetProperty("options")
            .EnumerateArray()
            .Single(option => option.GetProperty("optionText").GetString() == "أ")
            .GetProperty("optionId")
            .GetGuid();
        var itemId = question.GetProperty("quizVersionItemId").GetGuid();

        var answerResponse = await player.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{attemptId}/answers",
            guestToken,
            new { quizVersionItemId = itemId, answerJson = $$"""{"optionId":"{{correctOption}}"}""" }));
        Assert.Equal(HttpStatusCode.OK, answerResponse.StatusCode);
        var answer = await ReadJson<JsonElement>(answerResponse);
        Assert.Equal(JsonValueKind.Null, answer.GetProperty("isCorrect").ValueKind);
        Assert.Equal(JsonValueKind.Null, answer.GetProperty("scoreAwarded").ValueKind);

        var closed = await ControlAsync(teacher, setup, "questions/close", 1, setup.AccessToken);
        Assert.Equal("QuestionClosed", closed.GetProperty("phase").GetString());
        Assert.Equal(1, closed.GetProperty("answeredCount").GetInt32());
        Assert.Equal(5m, closed.GetProperty("leaderboard")[0].GetProperty("score").GetDecimal());

        var openedSecond = await ControlAsync(teacher, setup, "questions/open-next", 2, setup.AccessToken);
        var secondQuestion = await GetCurrentQuestionAsync(player, setup.JoinCode, attemptId, guestToken);
        Assert.Equal(1, secondQuestion.GetProperty("index").GetInt32());
        var wrongOption = secondQuestion.GetProperty("options")
            .EnumerateArray()
            .Single(option => option.GetProperty("optionText").GetString() == "ب")
            .GetProperty("optionId")
            .GetGuid();
        await player.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{attemptId}/answers",
            guestToken,
            new
            {
                quizVersionItemId = secondQuestion.GetProperty("quizVersionItemId").GetGuid(),
                answerJson = $$"""{"optionId":"{{wrongOption}}"}"""
            }));

        var playerFinish = await player.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{attemptId}/finish",
            guestToken));
        Assert.Equal(HttpStatusCode.Conflict, playerFinish.StatusCode);

        await ControlAsync(teacher, setup, "questions/close", openedSecond.GetProperty("revision").GetInt32(), setup.AccessToken);
        var finished = await ControlAsync(teacher, setup, "finish", 4, setup.AccessToken);
        Assert.Equal("Finished", finished.GetProperty("phase").GetString());
        Assert.Equal("Finished", finished.GetProperty("sessionStatus").GetString());

        var result = await ReadJson<JsonElement>(await player.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{attemptId}/result",
            guestToken)));
        Assert.Equal("Finished", result.GetProperty("status").GetString());
        Assert.Equal(5m, result.GetProperty("score").GetDecimal());
        Assert.Equal(10m, result.GetProperty("maxScore").GetDecimal());
        Assert.True(result.GetProperty("passed").GetBoolean());
    }

    [Fact]
    public async Task SignalR_Groups_AreAuthorizedAndIsolatedPerSession()
    {
        var teacher = NewClient();
        var first = await CreateLiveSetupAsync(teacher, "live-hub-a");
        var second = await CreateLiveSessionForQuizAsync(
            teacher,
            first.AccessToken,
            first.TenantId,
            first.QuizId);

        await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            await using var unauthorized = BuildHubConnection(null);
            await unauthorized.StartAsync();
        });

        var firstToken = await GetTeacherLiveTokenAsync(teacher, first, first.AccessToken);
        var secondToken = await GetTeacherLiveTokenAsync(teacher, second, second.AccessToken);
        await using var firstConnection = BuildHubConnection(firstToken);
        await using var secondConnection = BuildHubConnection(secondToken);
        var firstEvent = new TaskCompletionSource<LiveSessionStateResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondEvent = new TaskCompletionSource<LiveSessionStateResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        firstConnection.On<LiveSessionStateResponse>(LiveEventNames.QuestionOpened, state => firstEvent.TrySetResult(state));
        secondConnection.On<LiveSessionStateResponse>(LiveEventNames.QuestionOpened, state => secondEvent.TrySetResult(state));

        await firstConnection.StartAsync();
        await secondConnection.StartAsync();
        await ControlAsync(teacher, first, "questions/open-next", 0, first.AccessToken);

        var received = await firstEvent.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(first.SessionId, received.SessionId);
        await Task.Delay(300);
        Assert.False(secondEvent.Task.IsCompleted);
    }

    [Fact]
    public async Task LiveSession_AcceptsThirtyConcurrentParticipants_WithoutDuplicateAttempts()
    {
        var teacher = NewClient();
        var setup = await CreateLiveSetupAsync(teacher, "live-load-30");
        await ControlAsync(teacher, setup, "questions/open-next", 0, setup.AccessToken);

        var players = await Task.WhenAll(Enumerable.Range(1, 30).Select(async index =>
        {
            var client = NewClient();
            var guestToken = await JoinAsync(client, setup.JoinCode, $"لاعب {index:00}");
            var firstStart = await StartAttemptAsync(client, setup.JoinCode, guestToken);
            var secondStart = await StartAttemptAsync(client, setup.JoinCode, guestToken);
            Assert.Equal(firstStart.GetProperty("attemptId").GetGuid(), secondStart.GetProperty("attemptId").GetGuid());
            return (client, guestToken, AttemptId: firstStart.GetProperty("attemptId").GetGuid());
        }));

        await Task.WhenAll(players.Select(async player =>
        {
            var question = await GetCurrentQuestionAsync(player.client, setup.JoinCode, player.AttemptId, player.guestToken);
            var optionId = question.GetProperty("options")[0].GetProperty("optionId").GetGuid();
            var response = await player.client.SendAsync(PlayerRequest(
                HttpMethod.Post,
                $"/api/v1/player/sessions/{setup.JoinCode}/attempts/{player.AttemptId}/answers",
                player.guestToken,
                new
                {
                    quizVersionItemId = question.GetProperty("quizVersionItemId").GetGuid(),
                    answerJson = $$"""{"optionId":"{{optionId}}"}"""
                }));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }));

        var state = await ControlAsync(teacher, setup, "questions/close", 1, setup.AccessToken);
        Assert.Equal(30, state.GetProperty("participantCount").GetInt32());
        Assert.Equal(30, state.GetProperty("attemptCount").GetInt32());
        Assert.Equal(30, state.GetProperty("answeredCount").GetInt32());
        Assert.Equal(30, state.GetProperty("leaderboard").GetArrayLength());
    }

    private HubConnection BuildHubConnection(string? accessToken)
    {
        return new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/quiz"), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                if (accessToken is not null)
                {
                    options.AccessTokenProvider = () => Task.FromResult<string?>(accessToken);
                }
            })
            .Build();
    }

    private async Task<LiveSetup> CreateLiveSetupAsync(HttpClient client, string slugPrefix)
    {
        var accessToken = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, accessToken);
        var quizId = await CreatePublishedQuizAsync(client, accessToken, tenantId, slugPrefix);
        return await CreateLiveSessionForQuizAsync(client, accessToken, tenantId, quizId);
    }

    private async Task<LiveSetup> CreateLiveSessionForQuizAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        Guid quizId)
    {
        var create = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions",
            accessToken,
            new { mode = "Live", label = "مسابقة مباشرة" }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var session = await ReadJson<JsonElement>(create);
        var sessionId = session.GetProperty("id").GetGuid();
        var joinCode = session.GetProperty("joinCode").GetString()!;
        Assert.Equal("Live", session.GetProperty("mode").GetString());

        var activate = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate",
            accessToken,
            new { baseVersion = session.GetProperty("version").GetUInt32() }));
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);
        return new LiveSetup(accessToken, tenantId, quizId, sessionId, joinCode);
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"live-{Guid.NewGuid():N}@example.test";
        await client.PostAsync("/api/v1/auth/register", Json(new
        {
            email,
            password = "SecurePassword123!",
            fullName = "Live Teacher"
        }));
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, EmailKind.Confirmation)!;
        var query = System.Web.HttpUtility.ParseQueryString(new Uri(confirmUrl).Query);
        await client.PostAsync("/api/v1/auth/confirm-email", Json(new
        {
            uid = query["uid"],
            token = query["token"]
        }));
        var login = await client.PostAsync("/api/v1/auth/login", Json(new
        {
            email,
            password = "SecurePassword123!"
        }));
        return (await ReadJson<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string accessToken)
    {
        var response = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            "/api/v1/tenants",
            accessToken,
            new
            {
                name = "Live Space",
                slug = $"lv-{Guid.NewGuid():N}"[..20],
                countryCode = "EG",
                timezone = "Africa/Cairo",
                defaultLocale = "ar"
            }));
        response.EnsureSuccessStatusCode();
        return (await ReadJson<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreatePublishedQuizAsync(
        HttpClient client,
        string accessToken,
        Guid tenantId,
        string slugPrefix)
    {
        var bank = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/question-banks",
            accessToken,
            new { name = "Live Bank" }));
        var bankId = (await ReadJson<JsonElement>(bank)).GetProperty("id").GetGuid();
        var questionIds = new List<Guid>();
        foreach (var prompt in new[] { "السؤال المباشر الأول", "السؤال المباشر الثاني" })
        {
            var question = await client.SendAsync(TeacherRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/questions",
                accessToken,
                new
                {
                    bankId,
                    questionType = "MultipleChoice",
                    prompt,
                    options = new[]
                    {
                        new { text = "أ", isCorrect = true },
                        new { text = "ب", isCorrect = false }
                    }
                }));
            questionIds.Add((await ReadJson<JsonElement>(question)).GetProperty("id").GetGuid());
        }

        var quiz = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes",
            accessToken,
            new
            {
                title = "اختبار مباشر",
                slug = $"{slugPrefix}-{Guid.NewGuid():N}"[..Math.Min(40, slugPrefix.Length + 33)]
            }));
        var quizId = (await ReadJson<JsonElement>(quiz)).GetProperty("id").GetGuid();
        foreach (var questionId in questionIds)
        {
            var add = await client.SendAsync(TeacherRequest(
                HttpMethod.Post,
                $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items",
                accessToken,
                new { questionId, points = 5, isRequired = true }));
            Assert.Equal(HttpStatusCode.OK, add.StatusCode);
        }

        var draft = await client.SendAsync(TeacherRequest(
            HttpMethod.Get,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft",
            accessToken));
        var version = (await ReadJson<JsonElement>(draft)).GetProperty("version").GetUInt32();
        var publish = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish",
            accessToken,
            new { baseVersion = version }));
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        return quizId;
    }

    private static async Task<string> JoinAsync(HttpClient client, string joinCode, string displayName)
    {
        var response = await client.PostAsync(
            $"/api/v1/player/sessions/{joinCode}/join",
            Json(new { displayName }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = response.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith($"{GuestCookieName}=", StringComparison.Ordinal));
        return cookie.Split(';')[0][(GuestCookieName.Length + 1)..];
    }

    private static async Task<JsonElement> StartAttemptAsync(
        HttpClient client,
        string joinCode,
        string guestToken)
    {
        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Post,
            $"/api/v1/player/sessions/{joinCode}/attempts",
            guestToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> GetCurrentQuestionAsync(
        HttpClient client,
        string joinCode,
        Guid attemptId,
        string guestToken)
    {
        var response = await client.SendAsync(PlayerRequest(
            HttpMethod.Get,
            $"/api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question",
            guestToken));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<JsonElement> ControlAsync(
        HttpClient client,
        LiveSetup setup,
        string action,
        int revision,
        string accessToken)
    {
        var response = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{setup.TenantId}/quizzes/{setup.QuizId}/sessions/{setup.SessionId}/live/{action}",
            accessToken,
            new { baseRevision = revision, durationSeconds = action.Contains("open", StringComparison.Ordinal) ? 30 : (int?)null }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson<JsonElement>(response);
    }

    private static async Task<string> GetTeacherLiveTokenAsync(
        HttpClient client,
        LiveSetup setup,
        string accessToken)
    {
        var response = await client.SendAsync(TeacherRequest(
            HttpMethod.Post,
            $"/api/v1/tenants/{setup.TenantId}/quizzes/{setup.QuizId}/sessions/{setup.SessionId}/live/token",
            accessToken));
        response.EnsureSuccessStatusCode();
        return (await ReadJson<JsonElement>(response)).GetProperty("accessToken").GetString()!;
    }

    private HttpClient NewClient() => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        HandleCookies = false
    });

    private static HttpRequestMessage TeacherRequest(
        HttpMethod method,
        string path,
        string accessToken,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static HttpRequestMessage PlayerRequest(
        HttpMethod method,
        string path,
        string guestToken,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Cookie", $"{GuestCookieName}={guestToken}");
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<T> ReadJson<T>(HttpResponseMessage response) =>
        (await JsonSerializer.DeserializeAsync<T>(
            await response.Content.ReadAsStreamAsync(),
            JsonOptions))!;

    private sealed record LiveSetup(
        string AccessToken,
        Guid TenantId,
        Guid QuizId,
        Guid SessionId,
        string JoinCode);
}
