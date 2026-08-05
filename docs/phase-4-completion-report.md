# Phase 4 — Student Player, Sessions & Server-side Scoring — تقرير الإغلاق

**التاريخ:** 2026-08-05
**الفرع:** `feature/phase-4-player-scoring`
**القاعدة:** `75a8dbba123f8f95c50d11900034687d0a952d22` (نهاية Phase 3)

---

## النتيجة

Phase 4 منفذة فعليًا وكاملة على مستوى Backend وFrontend والاختبارات والـMigrations:

- **Self-paced Player فقط** — إنشاء جلسة `Mode=Live` يرفض بـ`400 LiveModeNotAvailable`.
- **نموذج البيانات:** `QuizSession` / `SessionParticipant` / `Attempt` / `AttemptAnswer` بعزل Tenant كامل (FKs مركبة، NoAction).
- **أمان الضيوف:** رمز 256-bit، تخزين هاش SHA-256 فقط، مقارنة ثابتة الزمن، كوكي HttpOnly `__Host-tp-guest`، وRate limiting على كل نقاط اللاعب (ADR 007).
- **خلط حتمي** للأسئلة لكل مشارك عبر `ShuffleSeed` + `SeededShuffler` — استئناف آمن بعد F5.
- **DTO لاعب آمن:** لا `IsCorrect` ولا `acceptedAnswers` قبل الإنهاء.
- **تصحيح خادمي** لخمسة أنواع أسئلة عبر `AnswerScorer` (دالة نقية بلا استثناءات).
- **Idempotency:** إعادة نفس الإجابة = 200؛ إجابة مختلفة = `409 AnswerConflict` — بمقارنة JSON **دلالية** (إصلاح bug حقيقي سببه تطبيع `jsonb`).
- **وقت خادمي مرجعي:** `serverNow` في كل استجابة + settle-on-request (`TimedOut` عند أول طلب بعد `DeadlineAt`).
- **واجهتا معلم ولاعب** كاملتان في `apps/web`.

---

## الملفات الرئيسية

### Backend (Domain)
- `Domain/Sessions/QuizSession.cs` — الجلسة: JoinCode, Mode, Status, QuizVersionId, xmin.
- `Domain/Sessions/SessionParticipant.cs` — DisplayName, GuestTokenHash, ShuffleSeed.
- `Domain/Sessions/Attempt.cs` — Status, StartedAt/DeadlineAt/FinishedAt, CurrentQuestionIndex, TotalScore.
- `Domain/Sessions/AttemptAnswer.cs` — AnswerJson (jsonb), IsCorrect, ScoreAwarded.
- `Domain/Sessions/AnswerScorer.cs` — تصحيح الأنواع الخمسة + `NormalizeText`.
- `Domain/Sessions/SeededShuffler.cs` — خلط حتمي بالبذرة.

### Backend (Application / Infrastructure / Api)
- `Application/Sessions/SessionDtos.cs` — كل DTOs (Teacher + Player).
- `Application/Options/SessionOptions.cs` — إعدادات الجلسات.
- `Infrastructure/Services/SessionService.cs` — Use Cases المعلم (إنشاء/تفعيل/إنهاء/إلغاء).
- `Infrastructure/Services/PlayerService.cs` — Use Cases اللاعب + `AnswerJsonEquals`/`JsonElementDeepEquals` (إصلاح idempotency).
- `Infrastructure/Services/GuestTokenService.cs` — توليد/هاش/مقارنة ثابتة الزمن.
- `Persistence/Configurations/SessionConfigurations.cs` — 4 جداول + FKs مركبة + `AnswerJson` jsonb.
- `Persistence/Migrations/20260804014225_CreateSessionsAndAttempts.*` — Migration Phase 4.
- `Controllers/SessionsController.cs` — Teacher API تحت `/api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions`.
- `Controllers/PlayerController.cs` — Player API `[AllowAnonymous]` + rate-limited تحت `/api/v1/player/sessions`.

### Frontend
- `src/types/sessions.ts` — TypeScript types لكل DTOs.
- `src/data/api-client/endpoints.ts` — `sessionsApi` + `playerApi`.
- `src/routes/dashboard/quizzes/sessions/` — صفحات المعلم (قائمة/إنشاء/تفاصيل الجلسة).
- `src/routes/play/play-page.tsx` — مشغل الطالب `/play/:joinCode`: join → ready → playing → result، مع auto-resume وعدّ تنازلي خادمي.

---

## التحقق المنفذ

| أمر | النتيجة |
|-----|---------|
| `dotnet restore` | نجاح |
| `dotnet format --verify-no-changes` | Exit 0 |
| `dotnet build` | 0 خطأ، 0 تحذير |
| `dotnet test` | Domain **50/50** + Api **1/1** + Integration **83/83** = **134/134** |
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm run test` | **73/73** (14 ملفًا) |
| `npm run build` | ✓ built |
| `dotnet ef migrations script --idempotent` | ✓ توليد ناجح |
| تطبيق السكربت Idempotent مرتين على `teacher_platform_ci` | ✓ بدون خطأ — الجداول الأربعة موجودة |

### اختبارات Phase 4 الجديدة
- `AnswerScorerTests` (18) — كل الأنواع + التطبيع + التقريب + الإدخال الفاسد.
- `SeededShufflerTests` (7) — حتمية البذرة واختلاف البذر.
- `SessionPlayerFlowTests` (17، PostgreSQL حقيقي) — إنشاء/تفعيل/انضمام/بدء/إجابة/إنهاء/نتيجة، Idempotency (200/409)، LiveMode 400، 401 بدون كوكي، settle-on-request، استئناف.
- `play-page.test.tsx` (8) — نماذج الانضمام، التحقق من الاسم، 409، auto-resume.

---

## Bug حقيقي اكتُشف وأُصلح

**تطبيع `jsonb` يكسر Idempotency:** عمود `AttemptAnswers.AnswerJson` نوعه `jsonb`، وPostgreSQL يطبّع المخزن (مسافات/ترتيب مفاتيح/تمثيل أرقام). المقارنة النصية الحرفية بين المخزن والوارد كانت تعيد `409` زورًا عند إعادة إرسال **نفس** الإجابة. أصلحتها اختبارات التكامل، والحل مقارنة دلالية (`AnswerJsonEquals` + `JsonElementDeepEquals`) في `PlayerService` — موثق في ADR 008.

---

## Endpoints (تحت `/api/v1`)

### Teacher Sessions (مصادق عليها)
```text
POST   /tenants/{tenantId}/quizzes/{quizId}/sessions
GET    /tenants/{tenantId}/quizzes/{quizId}/sessions
GET    /tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}
POST   /tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate
POST   /tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/finish
POST   /tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/cancel
```

### Player (بدون مصادقة — Rate-limited)
```text
GET    /player/sessions/{joinCode}
POST   /player/sessions/{joinCode}/join
POST   /player/sessions/{joinCode}/attempts
GET    /player/sessions/{joinCode}/attempts/{attemptId}/current-question
POST   /player/sessions/{joinCode}/attempts/{attemptId}/answers
POST   /player/sessions/{joinCode}/attempts/{attemptId}/finish
GET    /player/sessions/{joinCode}/attempts/{attemptId}/result
GET    /player/sessions/{joinCode}/attempts/{attemptId}/media/{mediaId}
```

---

## نقص حقيقي (غير مُجمل)

1. **لا يوجد Live Mode** — مؤجل لـPhase 6 (SignalR)؛ الطلب يرفض صراحة بـ`LiveModeNotAvailable`.
2. **لا يوجد E2E Playwright** — التغطية Integration + Frontend unit؛ E2E مؤجل لـPhase 8.
3. **settle-on-request** يعني أن محاولة منتهية الوقت بلا تفاعل تبقى `InProgress` حتى أول طلب لاحق — لا أثر وظيفي (ADR 008).
4. **تصحيح Ordering الجزئي** يحسب المواضع الصحيحة فقط — سياسة أولى قابلة للتغيير (ADR 008).
5. **لا إبطال فردي لرمز الضيف** دون حذف المشارك — يُؤجل حتى ظهور حاجة (ADR 007).

---

## Commits و Final SHA

- `5b60ecd` fix(quizzes): close GAP-C use-latest-version action and GAP-D tenant-scoped quiz limits
- `babca9c` feat(sessions): Phase 4 backend — self-paced player, guest tokens, server-side scoring
- `7392af6` feat(frontend): Phase 4 — teacher sessions UI + student player
- `78f6881` test(sessions): Phase 4 tests — scorer, shuffler, player flow, play page
- `49a1b0a` docs: Phase 4 — sessions/player API, schema, ADRs 007/008, completion report

**Final SHA:** `49a1b0afe78706b3010b1fb50af93067e7b37716` (commit التوثيق قبل amend تحديث هذا السطر؛ الـ SHA الفعلي النهائي يُؤخذ من `git rev-parse HEAD`)

**Git:** `git status --short` فارغ بعد commit التوثيق.

---

## الخطوة التالية

Phase 5 — التقارير والتصدير: نتائج الجلسات للمعلم، تصدير CSV/Excel، وإحصاءات الأسئلة.
