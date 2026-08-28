from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:180]!r}")
    write(path, text.replace(old, new, 1))


def replace_in_tail(path: str, anchor: str, old: str, new: str) -> None:
    text = read(path)
    anchor_index = text.find(anchor)
    if anchor_index < 0:
        raise SystemExit(f"Anchor not found in {path}: {anchor[:160]!r}")
    head, tail = text[:anchor_index], text[anchor_index:]
    if old not in tail:
        raise SystemExit(f"Expected anchored block not found in {path}: {old[:180]!r}")
    write(path, head + tail.replace(old, new, 1))


# 1) Persist an idempotency key on launch-created sessions.
session_domain = "backend/src/TeacherPlatform.Domain/Sessions/QuizSession.cs"
replace_once(
    session_domain,
    """    /// <summary>رمز الانضمام — عشوائي غير متسلسل، URL-safe، غير قابل للتخمين.</summary>\n    public string JoinCode { get; set; } = string.Empty;""",
    """    /// <summary>رمز الانضمام — عشوائي غير متسلسل، URL-safe، غير قابل للتخمين.</summary>\n    public string JoinCode { get; set; } = string.Empty;\n\n    /// <summary>\n    /// مفتاح idempotency لعملية «تجهيز رابط الطلاب». nullable حتى تبقى الجلسات\n    /// اليدوية/القديمة بلا تغيير، وفريد داخل المستأجر عند وجوده.\n    /// </summary>\n    public Guid? LaunchRequestId { get; set; }""",
)

session_config = "backend/src/TeacherPlatform.Infrastructure/Persistence/Configurations/SessionConfigurations.cs"
replace_once(
    session_config,
    """        builder.HasIndex(s => s.JoinCode).IsUnique();\n        builder.HasIndex(s => s.TenantId);""",
    """        builder.HasIndex(s => s.JoinCode).IsUnique();\n        // PostgreSQL allows multiple NULL values in a unique index; legacy/manual sessions stay unaffected.\n        builder.HasIndex(s => new { s.TenantId, s.LaunchRequestId }).IsUnique();\n        builder.HasIndex(s => s.TenantId);""",
)

# 2) Application contract: one teacher action, one stable request id.
dtos = "backend/src/TeacherPlatform.Application/Sessions/SessionDtos.cs"
replace_once(
    dtos,
    """public sealed class CreateSessionRequest\n{""",
    """public sealed class ActivityLaunchRequest\n{\n    /// <summary>Stable UUID generated once by the browser and reused after network failures.</summary>\n    [Required]\n    public Guid RequestId { get; set; }\n\n    [Required, RegularExpression(\"SelfPaced|Live|ProgressiveChallenge\")]\n    public string Mode { get; set; } = \"SelfPaced\";\n\n    [StringLength(200)]\n    public string? Label { get; set; }\n\n    /// <summary>xmin of the draft the teacher reviewed before pressing Prepare.</summary>\n    [Required]\n    public uint DraftBaseVersion { get; set; }\n}\n\npublic sealed class CreateSessionRequest\n{""",
)

# 3) Publish may participate in an outer transaction while preserving standalone behavior.
quiz_service = "backend/src/TeacherPlatform.Infrastructure/Services/QuizService.cs"
replace_once(
    quiz_service,
    """        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);\n\n        // 1) تقاعد النسخة المنشورة السابقة""",
    """        await using var transaction = _db.Database.CurrentTransaction is null\n            ? await _db.Database.BeginTransactionAsync(cancellationToken)\n            : null;\n\n        // 1) تقاعد النسخة المنشورة السابقة""",
)
replace_once(
    quiz_service,
    """            await _db.SaveChangesAsync(cancellationToken);\n            await transaction.CommitAsync(cancellationToken);\n        }\n        catch (DbUpdateConcurrencyException)""",
    """            await _db.SaveChangesAsync(cancellationToken);\n            if (transaction is not null)\n            {\n                await transaction.CommitAsync(cancellationToken);\n            }\n        }\n        catch (DbUpdateConcurrencyException)""",
)

# 4) Session creation can persist a launch id; activation becomes safe to retry after a lost response.
session_service = "backend/src/TeacherPlatform.Infrastructure/Services/SessionService.cs"
replace_once(
    session_service,
    """    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> CreateAsync(\n        Guid quizId,\n        CreateSessionRequest request,\n        CancellationToken cancellationToken)""",
    """    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> CreateAsync(\n        Guid quizId,\n        CreateSessionRequest request,\n        CancellationToken cancellationToken,\n        Guid? launchRequestId = null)""",
)
replace_once(
    session_service,
    """            QuizVersionId = publishedVersionId,\n            JoinCode = joinCode,\n            Mode = mode,""",
    """            QuizVersionId = publishedVersionId,\n            JoinCode = joinCode,\n            LaunchRequestId = launchRequestId,\n            Mode = mode,""",
)
transition_anchor = """    private async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> TransitionAsync("""
replace_in_tail(
    session_service,
    transition_anchor,
    """        if (session is null)\n        {\n            return (new ServiceResultException(\"NotFound\", \"Session not found.\"), null);\n        }\n\n        if (request.BaseVersion != session.Version)""",
    """        if (session is null)\n        {\n            return (new ServiceResultException(\"NotFound\", \"Session not found.\"), null);\n        }\n\n        // If activation succeeded but the response was lost, the same stale request is still a success.\n        if (from == SessionStatus.Scheduled && to == SessionStatus.Active && session.Status == SessionStatus.Active)\n        {\n            return (null, await BuildDetailAsync(sessionId, cancellationToken));\n        }\n\n        if (request.BaseVersion != session.Version)""",
)

# 5) Server-side orchestration owns Publish -> Create -> Activate in one transaction.
service_path = Path("backend/src/TeacherPlatform.Infrastructure/Services/ActivityLaunchService.cs")
service_path.write_text(
    """using Microsoft.EntityFrameworkCore;\nusing Npgsql;\nusing TeacherPlatform.Application.Abstractions;\nusing TeacherPlatform.Application.Quizzes;\nusing TeacherPlatform.Application.Sessions;\nusing TeacherPlatform.Application.Tenancy;\nusing TeacherPlatform.Domain.Sessions;\nusing TeacherPlatform.Infrastructure.Persistence;\n\nnamespace TeacherPlatform.Infrastructure.Services;\n\n/// <summary>\n/// Durable use case behind the teacher's «Prepare student link» button.\n/// Publish, session creation and activation either commit together or roll back together.\n/// RequestId makes network retries return the same session instead of creating duplicates.\n/// </summary>\npublic sealed class ActivityLaunchService\n{\n    private readonly AppDbContext _db;\n    private readonly ITenantContext _tenantContext;\n    private readonly QuizService _quizService;\n    private readonly SessionService _sessionService;\n\n    public ActivityLaunchService(\n        AppDbContext db,\n        ITenantContext tenantContext,\n        QuizService quizService,\n        SessionService sessionService)\n    {\n        _db = db;\n        _tenantContext = tenantContext;\n        _quizService = quizService;\n        _sessionService = sessionService;\n    }\n\n    public async Task<(ServiceResultException? Error, SessionDetailResponse? Result)> LaunchAsync(\n        Guid quizId,\n        ActivityLaunchRequest request,\n        CancellationToken cancellationToken)\n    {\n        RequireTenantId();\n\n        if (request.RequestId == Guid.Empty)\n        {\n            return (new ServiceResultException(\"Validation\", \"RequestId must be a non-empty UUID.\"), null);\n        }\n\n        if (!Enum.TryParse<SessionMode>(request.Mode, ignoreCase: true, out var mode))\n        {\n            return (new ServiceResultException(\"Validation\", \"Mode must be SelfPaced, Live or ProgressiveChallenge.\"), null);\n        }\n\n        var existing = await FindExistingAsync(request.RequestId, cancellationToken);\n        if (existing is not null)\n        {\n            return ValidateExisting(existing, quizId, mode);\n        }\n\n        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);\n        try\n        {\n            var (draftError, draft) = await _quizService.GetDraftAsync(quizId, cancellationToken);\n            if (draftError is not null || draft is null)\n            {\n                return (draftError ?? new ServiceResultException(\"NotFound\", \"Quiz draft not found.\"), null);\n            }\n\n            if (draft.Version != request.DraftBaseVersion)\n            {\n                return (new ServiceResultException(\"Conflict\", \"The activity changed. Reload it before preparing a student link.\"), null);\n            }\n\n            if (!string.Equals(draft.PublicationState, \"PublishedCurrent\", StringComparison.Ordinal))\n            {\n                var (publishError, _) = await _quizService.PublishAsync(\n                    quizId,\n                    new PublishQuizRequest { BaseVersion = request.DraftBaseVersion },\n                    cancellationToken);\n                if (publishError is not null)\n                {\n                    return (publishError, null);\n                }\n            }\n\n            var (createError, created) = await _sessionService.CreateAsync(\n                quizId,\n                new CreateSessionRequest { Mode = request.Mode, Label = request.Label ?? draft.Title },\n                cancellationToken,\n                request.RequestId);\n            if (createError is not null || created is null)\n            {\n                return (createError ?? new ServiceResultException(\"Conflict\", \"Could not create the activity session.\"), null);\n            }\n\n            SessionDetailResponse result = created;\n            if (mode != SessionMode.Live)\n            {\n                var (activationError, activated) = await _sessionService.ActivateAsync(\n                    created.Id,\n                    new SessionStateChangeRequest { BaseVersion = created.Version },\n                    cancellationToken);\n                if (activationError is not null || activated is null)\n                {\n                    return (activationError ?? new ServiceResultException(\"Conflict\", \"Could not activate the activity session.\"), null);\n                }\n\n                result = activated;\n            }\n\n            await transaction.CommitAsync(cancellationToken);\n            return (null, result);\n        }\n        catch (DbUpdateException exception) when (IsUniqueViolation(exception))\n        {\n            await transaction.RollbackAsync(cancellationToken);\n            _db.ChangeTracker.Clear();\n            var winner = await FindExistingAsync(request.RequestId, cancellationToken);\n            return winner is null\n                ? (new ServiceResultException(\"Conflict\", \"The launch request conflicted with another request. Try again.\"), null)\n                : ValidateExisting(winner, quizId, mode);\n        }\n    }\n\n    private async Task<SessionDetailResponse?> FindExistingAsync(Guid requestId, CancellationToken cancellationToken)\n    {\n        var sessionId = await _db.QuizSessions\n            .AsNoTracking()\n            .Where(session => session.LaunchRequestId == requestId)\n            .Select(session => (Guid?)session.Id)\n            .SingleOrDefaultAsync(cancellationToken);\n\n        return sessionId is Guid id ? await _sessionService.GetAsync(id, cancellationToken) : null;\n    }\n\n    private static (ServiceResultException? Error, SessionDetailResponse? Result) ValidateExisting(\n        SessionDetailResponse existing,\n        Guid quizId,\n        SessionMode mode)\n    {\n        if (existing.QuizId != quizId || !string.Equals(existing.Mode, mode.ToString(), StringComparison.Ordinal))\n        {\n            return (new ServiceResultException(\"Conflict\", \"RequestId was already used for a different activity launch.\"), null);\n        }\n\n        return (null, existing);\n    }\n\n    private Guid RequireTenantId() =>\n        _tenantContext.IsResolved && _tenantContext.TenantId is Guid tenantId && tenantId != Guid.Empty\n            ? tenantId\n            : throw new ServiceResultException(\"TenantContextMissing\", \"Tenant context is not resolved for this request.\");\n\n    private static bool IsUniqueViolation(DbUpdateException exception) =>\n        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };\n}\n""",
    encoding="utf-8",
)

# 6) HTTP boundary and DI.
controller = "backend/src/TeacherPlatform.Api/Controllers/SessionsController.cs"
replace_once(
    controller,
    """    private readonly SessionService _sessionService;\n\n    public SessionsController(SessionService sessionService)\n    {\n        _sessionService = sessionService;\n    }""",
    """    private readonly SessionService _sessionService;\n    private readonly ActivityLaunchService _activityLaunchService;\n\n    public SessionsController(SessionService sessionService, ActivityLaunchService activityLaunchService)\n    {\n        _sessionService = sessionService;\n        _activityLaunchService = activityLaunchService;\n    }""",
)
marker = """    /// <summary>إنشاء جلسة جديدة على النسخة المنشورة الحالية للاختبار.</summary>\n    [HttpPost]"""
launch_endpoint = """    /// <summary>\n    /// تجهيز نشاط للطلاب كعملية واحدة retry-safe: ينشر عند الحاجة، ينشئ جلسة،\n    /// ويفعّل الأنماط الفردية. Live يبقى Scheduled حتى يضغط المعلم «ابدأ».\n    /// </summary>\n    [HttpPost(\"launch\")]\n    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]\n    [ProducesResponseType(typeof(SessionDetailResponse), StatusCodes.Status200OK)]\n    [ProducesResponseType(StatusCodes.Status400BadRequest)]\n    [ProducesResponseType(StatusCodes.Status404NotFound)]\n    [ProducesResponseType(StatusCodes.Status409Conflict)]\n    public async Task<IActionResult> Launch(\n        [FromRoute] Guid tenantId,\n        [FromRoute] Guid quizId,\n        [FromBody] ActivityLaunchRequest request,\n        CancellationToken cancellationToken)\n    {\n        if (!ModelState.IsValid)\n        {\n            return BadRequest(ModelState);\n        }\n\n        var (error, result) = await _activityLaunchService.LaunchAsync(quizId, request, cancellationToken);\n        if (error is not null)\n        {\n            throw error;\n        }\n\n        return Ok(result);\n    }\n\n""" + marker
replace_once(controller, marker, launch_endpoint)

program = "backend/src/TeacherPlatform.Api/Program.cs"
replace_once(
    program,
    """builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.SessionService>();\nbuilder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.PlayerService>();""",
    """builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.SessionService>();\nbuilder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.ActivityLaunchService>();\nbuilder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.PlayerService>();""",
)

# 7) Frontend contract: one HTTP call with one stable request id.
session_types = "apps/web/src/types/sessions.ts"
replace_once(
    session_types,
    """export interface CreateSessionRequest {\n  mode: SessionMode;\n  label?: string | null;\n}""",
    """export interface ActivityLaunchRequest {\n  requestId: string;\n  mode: SessionMode;\n  label?: string | null;\n  draftBaseVersion: number;\n}\n\nexport interface CreateSessionRequest {\n  mode: SessionMode;\n  label?: string | null;\n}""",
)

endpoints = "apps/web/src/data/api-client/endpoints.ts"
replace_once(
    endpoints,
    """  AttemptResult,\n  CreateSessionRequest,""",
    """  ActivityLaunchRequest,\n  AttemptResult,\n  CreateSessionRequest,""",
)
create_marker = """  create(tenantId: string, quizId: string, payload: CreateSessionRequest, signal?: AbortSignal) {\n    return call<SessionDetail>({\n      method: 'POST',\n      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions`,\n      body: payload,\n      signal,\n      needsAuth: true,\n      needsTenant: true,\n    });\n  },"""
replace_once(
    endpoints,
    create_marker,
    """  launch(tenantId: string, quizId: string, payload: ActivityLaunchRequest, signal?: AbortSignal) {\n    return call<SessionDetail>({\n      method: 'POST',\n      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/launch`,\n      body: payload,\n      signal,\n      needsAuth: true,\n      needsTenant: true,\n    });\n  },\n""" + create_marker,
)

launch_ts = Path("apps/web/src/features/activities/launch-activity.ts")
launch_ts.write_text(
    """import { quizzesApi, sessionsApi } from '../../data/api-client/endpoints';\nimport type { QuizDraft } from '../../types/quizzes';\nimport type { ActivityLaunchRequest, SessionDetail } from '../../types/sessions';\nimport type { ActivityMode } from './activity-mode';\n\nexport interface ActivityLaunchInput {\n  tenantId: string;\n  quizId: string;\n  mode: ActivityMode;\n  label?: string | null;\n  draft?: QuizDraft;\n  requestId?: string;\n}\n\nexport interface ActivityLaunchResult {\n  session: SessionDetail;\n  activated: boolean;\n}\n\nexport interface ActivityLaunchDependencies {\n  getDraft: (tenantId: string, quizId: string) => Promise<QuizDraft>;\n  launch: (tenantId: string, quizId: string, payload: ActivityLaunchRequest) => Promise<SessionDetail>;\n}\n\nconst defaultDependencies: ActivityLaunchDependencies = {\n  getDraft: (tenantId, quizId) => quizzesApi.getDraft(tenantId, quizId),\n  launch: (tenantId, quizId, payload) => sessionsApi.launch(tenantId, quizId, payload),\n};\n\nfunction launchStorageKey(tenantId: string, quizId: string, mode: ActivityMode) {\n  return `tp-activity-launch:${tenantId}:${quizId}:${mode}`;\n}\n\nfunction createUuid(): string {\n  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();\n  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {\n    const value = Math.floor(Math.random() * 16);\n    const nibble = character === 'x' ? value : (value & 0x3) | 0x8;\n    return nibble.toString(16);\n  });\n}\n\nexport function getOrCreateActivityLaunchRequestId(tenantId: string, quizId: string, mode: ActivityMode): string {\n  const key = launchStorageKey(tenantId, quizId, mode);\n  try {\n    const existing = sessionStorage.getItem(key);\n    if (existing) return existing;\n    const created = createUuid();\n    sessionStorage.setItem(key, created);\n    return created;\n  } catch {\n    return createUuid();\n  }\n}\n\nexport function clearActivityLaunchRequestId(tenantId: string, quizId: string, mode: ActivityMode) {\n  try {\n    sessionStorage.removeItem(launchStorageKey(tenantId, quizId, mode));\n  } catch {\n    // Storage can be blocked; correctness still comes from the server request id.\n  }\n}\n\n/** One teacher action maps to one retry-safe server use case. */\nexport async function launchActivity(\n  input: ActivityLaunchInput,\n  dependencies: ActivityLaunchDependencies = defaultDependencies,\n): Promise<ActivityLaunchResult> {\n  const draft = input.draft ?? await dependencies.getDraft(input.tenantId, input.quizId);\n  const requestId = input.requestId ?? getOrCreateActivityLaunchRequestId(input.tenantId, input.quizId, input.mode);\n  const session = await dependencies.launch(input.tenantId, input.quizId, {\n    requestId,\n    mode: input.mode,\n    label: input.label ?? draft.title,\n    draftBaseVersion: draft.version,\n  });\n  clearActivityLaunchRequestId(input.tenantId, input.quizId, input.mode);\n  return { session, activated: session.status === 'Active' };\n}\n""",
    encoding="utf-8",
)

launch_test = Path("apps/web/src/features/activities/launch-activity.test.ts")
launch_test.write_text(
    """import { beforeEach, describe, expect, it, vi } from 'vitest';\nimport type { QuizDraft } from '../../types/quizzes';\nimport type { SessionDetail } from '../../types/sessions';\nimport { getOrCreateActivityLaunchRequestId, launchActivity, type ActivityLaunchDependencies } from './launch-activity';\n\nconst draft: QuizDraft = {\n  id: 'draft-1', quizId: 'quiz-1', versionNumber: 1, title: 'Space Adventure', description: null,\n  instructions: null, passingPercentage: 50, timeMode: 'None', timeLimitSeconds: null,\n  shuffleQuestions: false, shuffleOptions: false,\n  theme: { template: 'default', primaryColor: '#0284c7', secondaryColor: '#0f172a', backgroundColor: '#ffffff' },\n  items: [], totalPoints: 0, publicationState: 'NeverPublished', version: 7, updatedAt: '2026-08-27T00:00:00Z',\n};\n\nconst activeSession: SessionDetail = {\n  id: 'session-1', quizId: 'quiz-1', quizTitle: 'Space Adventure', quizVersionId: 'version-1',\n  quizVersionNumber: 1, joinCode: 'SPARK123', mode: 'ProgressiveChallenge', status: 'Active',\n  label: 'Space Adventure', activatedAt: '2026-08-27T00:01:00Z', finishedAt: null,\n  createdAt: '2026-08-27T00:00:00Z', updatedAt: '2026-08-27T00:01:00Z', version: 4, participants: [],\n};\n\nfunction dependencies(session: SessionDetail = activeSession): ActivityLaunchDependencies {\n  return { getDraft: vi.fn().mockResolvedValue(draft), launch: vi.fn().mockResolvedValue(session) };\n}\n\ndescribe('launchActivity', () => {\n  beforeEach(() => sessionStorage.clear());\n\n  it('sends one server launch request with the reviewed draft version', async () => {\n    const deps = dependencies();\n    const result = await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'ProgressiveChallenge', draft, requestId: '7c75cfd6-0b99-4dd8-b924-5b0db95677c5' }, deps);\n    expect(deps.launch).toHaveBeenCalledWith('tenant-1', 'quiz-1', {\n      requestId: '7c75cfd6-0b99-4dd8-b924-5b0db95677c5', mode: 'ProgressiveChallenge', label: 'Space Adventure', draftBaseVersion: 7,\n    });\n    expect(result.session.status).toBe('Active');\n    expect(result.activated).toBe(true);\n  });\n\n  it('keeps the same request id across retries until success', async () => {\n    const first = getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced');\n    expect(getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced')).toBe(first);\n    const deps = dependencies({ ...activeSession, mode: 'SelfPaced' });\n    await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'SelfPaced', draft }, deps);\n    expect(getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced')).not.toBe(first);\n  });\n\n  it('leaves live launches scheduled until the teacher starts them', async () => {\n    const deps = dependencies({ ...activeSession, mode: 'Live', status: 'Scheduled', activatedAt: null });\n    const result = await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'Live', draft, requestId: '34353d74-47d7-4e58-a36a-30223e5e719a' }, deps);\n    expect(result.session.status).toBe('Scheduled');\n    expect(result.activated).toBe(false);\n  });\n});\n""",
    encoding="utf-8",
)

# 8) PostgreSQL integration coverage.
integration = Path("backend/tests/TeacherPlatform.IntegrationTests/ActivityLaunchFlowTests.cs")
integration.write_text(
    r'''using System.Net;
using System.Text;
using System.Text.Json;
using TeacherPlatform.IntegrationTests.Infrastructure;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public sealed class ActivityLaunchFlowTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ActivityLaunchFlowTests(TestWebApplicationFactory factory) => _factory = factory;
    public async Task InitializeAsync() => await _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;
    private HttpClient NewClient() => _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });
    private static StringContent Json(object payload) => new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

    [Fact]
    public async Task SelfPacedLaunch_RetryWithSameRequestId_ReturnsExactlySameSession()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Launch retry");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "retry");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { MultipleChoice(bankId, "Retry-safe question") });
        var draftVersion = await DraftVersionAsync(client, token, tenantId, quizId);
        var requestId = Guid.NewGuid();

        var first = await LaunchAsync(client, token, tenantId, quizId, requestId, "SelfPaced", draftVersion);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstBody = await ReadJsonAsync<JsonElement>(first);
        Assert.Equal("Active", firstBody.GetProperty("status").GetString());

        var retry = await LaunchAsync(client, token, tenantId, quizId, requestId, "SelfPaced", draftVersion);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var retryBody = await ReadJsonAsync<JsonElement>(retry);
        Assert.Equal(firstBody.GetProperty("id").GetGuid(), retryBody.GetProperty("id").GetGuid());
        Assert.Equal(firstBody.GetProperty("joinCode").GetString(), retryBody.GetProperty("joinCode").GetString());
        Assert.Equal(1, await SessionCountAsync(client, token, tenantId, quizId));
    }

    [Fact]
    public async Task ProgressiveLaunch_WhenModeValidationFailsAfterPublish_RollsBackPublishAndSession()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Launch rollback");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "rollback");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { ShortAnswer(bankId, "Type a word") });
        var draftBefore = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("NeverPublished", draftBefore.GetProperty("publicationState").GetString());

        var response = await LaunchAsync(client, token, tenantId, quizId, Guid.NewGuid(), "ProgressiveChallenge", draftBefore.GetProperty("version").GetUInt32());
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var draftAfter = await GetDraftAsync(client, token, tenantId, quizId);
        Assert.Equal("NeverPublished", draftAfter.GetProperty("publicationState").GetString());
        Assert.Equal(draftBefore.GetProperty("id").GetGuid(), draftAfter.GetProperty("id").GetGuid());
        Assert.Equal(0, await SessionCountAsync(client, token, tenantId, quizId));
    }

    [Fact]
    public async Task LiveActivation_RepeatingOriginalRequestAfterSuccess_IsIdempotent()
    {
        var client = NewClient();
        var token = await RegisterConfirmLoginAsync(client);
        var tenantId = await CreateTenantAsync(client, token, "Live retry");
        var bankId = await CreateBankAsync(client, token, tenantId);
        var quizId = await CreateQuizAsync(client, token, tenantId, "live");
        await AddQuestionsAsync(client, token, tenantId, quizId, new[] { MultipleChoice(bankId, "Live question") });
        var draftVersion = await DraftVersionAsync(client, token, tenantId, quizId);

        var launch = await LaunchAsync(client, token, tenantId, quizId, Guid.NewGuid(), "Live", draftVersion);
        Assert.Equal(HttpStatusCode.OK, launch.StatusCode);
        var scheduled = await ReadJsonAsync<JsonElement>(launch);
        Assert.Equal("Scheduled", scheduled.GetProperty("status").GetString());
        var sessionId = scheduled.GetProperty("id").GetGuid();
        var originalVersion = scheduled.GetProperty("version").GetUInt32();

        var activate = await StateChangeAsync(client, token, tenantId, quizId, sessionId, "activate", originalVersion);
        Assert.Equal(HttpStatusCode.OK, activate.StatusCode);
        Assert.Equal("Active", (await ReadJsonAsync<JsonElement>(activate)).GetProperty("status").GetString());

        var retry = await StateChangeAsync(client, token, tenantId, quizId, sessionId, "activate", originalVersion);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal("Active", (await ReadJsonAsync<JsonElement>(retry)).GetProperty("status").GetString());
    }

    private async Task<string> RegisterConfirmLoginAsync(HttpClient client)
    {
        var email = $"launch-{Guid.NewGuid():N}@example.test";
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/register", Json(new { email, password = "SecurePassword123!", fullName = "Launch Teacher" }))).StatusCode);
        var confirmUrl = _factory.EmailSender.LastActionUrlFor(email, TeacherPlatform.Application.Abstractions.EmailKind.Confirmation)!;
        var uri = new Uri(confirmUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/confirm-email", Json(new { uid = query["uid"], token = query["token"] }))).StatusCode);
        var login = await client.PostAsync("/api/v1/auth/login", Json(new { email, password = "SecurePassword123!" }));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return (await ReadJsonAsync<JsonElement>(login)).GetProperty("accessToken").GetString()!;
    }

    private static async Task<Guid> CreateTenantAsync(HttpClient client, string token, string name)
    {
        var slug = $"launch-{Guid.NewGuid():N}"[..24];
        var response = await client.SendAsync(Authorized(HttpMethod.Post, "/api/v1/tenants", token, new { name, slug, countryCode = "EG", timezone = "Africa/Cairo", defaultLocale = "ar" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateBankAsync(HttpClient client, string token, Guid tenantId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/question-banks", token, new { name = "Launch Bank" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateQuizAsync(HttpClient client, string token, Guid tenantId, string suffix)
    {
        var slug = $"launch-{suffix}-{Guid.NewGuid():N}";
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes", token, new { title = $"Launch {suffix}", slug, description = "launch test" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    private static async Task AddQuestionsAsync(HttpClient client, string token, Guid tenantId, Guid quizId, object[] questions)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/questions/bulk", token, new { quizId, questions }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static object MultipleChoice(Guid bankId, string prompt) => new { bankId, questionType = "MultipleChoice", prompt, explanation = (string?)null, difficulty = "Medium", language = "en", tags = Array.Empty<string>(), options = new object[] { new { text = "Correct", isCorrect = true }, new { text = "Wrong", isCorrect = false } }, acceptedAnswers = (string[]?)null };
    private static object ShortAnswer(Guid bankId, string prompt) => new { bankId, questionType = "ShortAnswer", prompt, explanation = (string?)null, difficulty = "Medium", language = "en", tags = Array.Empty<string>(), options = Array.Empty<object>(), acceptedAnswers = new[] { "spark" } };

    private static async Task<uint> DraftVersionAsync(HttpClient client, string token, Guid tenantId, Guid quizId) => (await GetDraftAsync(client, token, tenantId, quizId)).GetProperty("version").GetUInt32();
    private static async Task<JsonElement> GetDraftAsync(HttpClient client, string token, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<JsonElement>(response);
    }

    private static Task<HttpResponseMessage> LaunchAsync(HttpClient client, string token, Guid tenantId, Guid quizId, Guid requestId, string mode, uint draftVersion) =>
        client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/launch", token, new { requestId, mode, label = "Launch", draftBaseVersion = draftVersion }));

    private static Task<HttpResponseMessage> StateChangeAsync(HttpClient client, string token, Guid tenantId, Guid quizId, Guid sessionId, string action, uint baseVersion) =>
        client.SendAsync(Authorized(HttpMethod.Post, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/{action}", token, new { baseVersion }));

    private static async Task<int> SessionCountAsync(HttpClient client, string token, Guid tenantId, Guid quizId)
    {
        var response = await client.SendAsync(Authorized(HttpMethod.Get, $"/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions?page=1&pageSize=100", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<JsonElement>(response)).GetProperty("totalItems").GetInt32();
    }

    private static HttpRequestMessage Authorized(HttpMethod method, string url, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        if (body is not null) request.Content = Json(body);
        return request;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        return (await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions))!;
    }
}
''',
    encoding="utf-8",
)
