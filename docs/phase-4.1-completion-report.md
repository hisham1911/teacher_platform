# Phase 4.1 — Real-browser Session Hardening — تقرير الإغلاق

**التاريخ:** 2026-08-08
**الفرع:** `fix/phase-4-player-browser-hardening`
**القاعدة:** `bc9042e` (نهاية Phase 4)

---

## الهدف من الجولة

تحصين جانب المتصفح الحقيقي لمسارات الطالب (Phase 4) قبل إغلاقها:

1. **إثبات عقد Guest Cookie في Chromium حقيقي** — HttpOnly + Path=/ + SameSite=Lax + Secure=false + عدم قابلية القراءة من JS، مع استمرار الجلسة عبر F5.
2. **رفض حمولات الإجابة غير الصالحة** بنيويًا بـ`400 InvalidAnswerPayload` قبل أي حفظ/تسجيل.
3. **إثبات بقاء المحاولة والنتيجة بعد إعادة تشغيل الـAPI** (PostgreSQL) عبر E2E بالمتصفح.
4. **استعادة الجلسة من السيرفر فقط** عبر `GET /me` (لا `localStorage`) مع عقد حذف الكوكي العالق عند `401`.
5. **جعل E2E قابلة للتشغيل على clean clone** — بيئة `E2E` مدارة في Git + سكربتات في `e2e/`.
6. **تشغيل كل أدوات التحقق** وإصدار تقرير الإغلاق.

---

## النتيجة

- **`AnswerPayloadValidator`** (Domain): فحص بنيوي صارم — *انتماء* وليس صوابًا:
  - `MultipleChoice/TrueFalse/Listening`: `optionId` يجب أن يكون خيارًا فعليًا من نسخة السؤال المثبتة.
  - `ShortAnswer`: نص غير فارغ فقط.
  - `Ordering`: كامل، بلا تكرار، بلا أجنبي، بلا نقص.
  - يُستدعى في `PlayerService.SubmitAnswerAsync` **قبل** فحص Idempotency وأي حفظ؛ الرفض → `400 InvalidAnswerPayload` (خريطة جديدة في `GlobalExceptionHandler`).
  - `AnswerScorer` يبقى الدفاع الأخير: صفر لغير الصالح، لا يرمي استثناء أبدًا.
- **Frontend `/play/:joinCode`**:
  - تمييز `400 InvalidAnswerPayload` برسالة واضحة + البقاء على نفس السؤال وإعادة تفعيل الزر (بدون انهيار).
  - **استعادة الجلسة من السيرفر فقط عبر `GET /api/v1/player/sessions/{joinCode}/me`:** بعد F5/إعادة الفتح يقرّر السيرفر الوجهة (استئناف محاولة / نتيجة منتهية / شاشة بدء) من كوكي الضيف HttpOnly وحده — **بدون تخزين اسم الطالب في `localStorage`** (كان الحل الأولي يخزن الاسم؛ قُدّمت جولة لاحقة وأزلته). الاسم والوجهة مصدرهما نفس `JoinSessionResponse`.
  - **عقد حذف الكوكي العالق:** عند أي `401` على مسارات `player/sessions` يُحذف كوكي الضيف عديم الفائدة من المتصفح — التنفيذ في `GlobalExceptionHandler` (بعد `Response.Clear()` الذي يمسح Set-Cookie الصادرة من الكنترولر)، بنفس الاسم المُبسط `tp-guest`/`__Host-tp-guest` وسمات `Path=/ HttpOnly Secure SameSite`.
- **E2E Playwright في Chromium حقيقي** (Part A + Part B) مع إعادة تشغيل فعلية للـAPI بينهما — وتُمل من مستودع `e2e/` (بيئة `E2E` مدارة في Git).

---

## التحقق المنفذ

| أمر | النتيجة |
|-----|---------|
| `dotnet format --verify-no-changes` | Exit 0 |
| `dotnet build` | 0 خطأ، 0 تحذير |
| `dotnet test` (INTEGRATION_TEST_DB) | Domain **62/62** + Api **1/1** + Integration **92/92** = **155/155** |
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm run test` | **78/78** (14 ملفًا) |
| `npm run build` | ✓ built |
| Playwright E2E (Chromium 151) | Part A ✓ + Part B ✓ (مرتان متتاليتان) |

### اختبارات جديدة في الجولة
- `AnswerPayloadValidatorTests` (12، Domain) — قواعد الأنواع الخمسة + الحواف (GUID أجنبي/تكراري/ناقص، JSON فاسد، نص فارغ، أنواع مفتاح خاطئة).
- `PlayerAnswerValidationTests` (3، PostgreSQL حقيقي) — حمولة فاسدة → 400 بلا تقدم؛ صالحة-لكن-خاطئة → 200/صفر؛ Idempotency/409 محفوظان.
- `GuestCookieTests` (6، PostgreSQL حقيقي) — عقد `Set-Cookie` في Dev (`tp-guest`: Path=/، Lax، Secure=false) والـProd (`__Host-tp-guest`: Secure، HttpOnly، SameSite=Lax)؛ استعادة `/me` لنفس المشارك/اسم العرض؛ استعادة `attemptId`+`InProgress` بعد بدء محاولة؛ وحذف الكوكي العالق عند `401` بنفس الاسم في Dev وProd.
- `play-page.test.tsx` (13، +5 جديدة) — إعادة ربط عبر `/me` تستأنف محاولة جارية، استعادة نتيجة منتهية مباشرة بعد F5، بقاء شاشة الانضمام عند 401، **ولا كتابة أي شيء في localStorage بعد الانضمام**.

---

## E2E الحقيقي (Chromium)

**السيناريو الكامل** على `http://localhost:5173/play/{joinCode}` مع API على `http://localhost:5000`:

1. **Part A:** انضمام باسم → بدء → إجابة السؤال الأول (صح) → إثبات الكوكي في Chromium:
   - `tp-guest` موجود، `httpOnly=true`، `path=/`، `secure=false`، `sameSite=Lax`.
   - `document.cookie` من JS **لا تحتويه**.
   - F5 → إعادة ربط تلقائية → استئناف مباشر عند السؤال الثاني (لا شاشة انضمام).
2. **إيقاف API وإعادة تشغيله فعليًا** (صفر فقدان — كل شيء في PostgreSQL).
3. **Part B:** نفس جلسة المتصفح (كوكي الضيف المحفوظ) → استئناف عند السؤال الثاني → إجابة الأخير → إنهاء → **10/10 · 100% · ناجح ✓** → F5 على صفحة النتيجة → **تستعاد النتيجة تلقائيًا عبر `/me`** (لا شاشة انضمام/استعداد).

السيناريو يجمع في جولة واحدة: عقد الكوكي، استمرارية المتصفح عبر F5، واستمرارية الخادم عبر إعادة تشغيله.

---

## اكتشافات وأسباب (Bugs/Findings)

1. **F5 بعد الإنهاء يفقد النتيجة (UX bug):** الجلسة تبقى `Active` بعد انتهاء محاولة المشارك، فكانت الصفحة بعد التحديث تعيد شاشة الانضمام وتتطلب إعادة انضمام + استئناف لرؤية النتيجة. أُصلح إصلاحه الأولي بتخزين الاسم و re-join تلقائي ثم **استُبدل بمصدر السيرفر وحده** (`GET /me`): لا بيانات محلية للاعب، والوجهة من حالة الخادم فقط.
2. **تقييد المعدل على localhost يكسر E2E (بيئة، لا كود):** `PlayerEndpoints` بـ`RateLimiting: 20/60s` لكل IP؛ كل حركة E2E تتشارك `127.0.0.1` فكان التقييد يعيد `429` بلا جسم على الإجابات ثم على `getSession`. أثبت ذلك من Trace المتصفح (POST answers → 429). **الحل:** بيئة `E2E` مدارة في Git (مستقلة عن `appsettings.Development.json`) بحد `200/60s` — الإنتاج يبقى 20/60s كما في `appsettings.Example.json`. سلوك «المحاولات كثيرة» في الواجهة يعمل (اللاعب يرى رسالة واضحة ويستطيع إعادة المحاولة لاحقًا).
3. **`Response.Clear()` يمسح Set-Cookie:** PUT/delete من الكنترولر قبل `throw` كانا يُفقدان عند `UseExceptionHandler` — لهذا انتقل حذف الكوكي العالق إلى `GlobalExceptionHandler` ليُطبق على الاستجابة الفعلية المكتوبة.

---

## إعدادات وأدوار البيئات

- `backend/src/TeacherPlatform.Api/appsettings.Development.json` (غير مُلتَزم) — كلمة سر قاعدة تطوير + `RateLimiting.PermitLimit: 200` للعمل اليدوي.
- `backend/src/TeacherPlatform.Api/appsettings.E2E.json` (مُلتزَم) — قاعدة `teacher_platform_e2e`، `UseSecureCookie=false`، `RateLimiting.PermitLimit: 200`؛ لا حاجة لأي Secret من المستنسخ النظيف.
- سكربتات E2E في **المستودع** `e2e/` (seed.mjs، part-a/part-b specs، run-api.cmd/run-web.cmd، README) — قابلة للتشغيل على clean clone.

---

## Commits و Final SHA

المُلتزَم قبل هذا التقرير:
- `8bba342` feat(sessions): strict answer payload validation -> 400 InvalidAnswerPayload
- `7d3e6bd` test(sessions): answer payload validation + guest cookie contract tests
- `b8a02bf` fix(player): auto-restore attempt/result on refresh + InvalidAnswerPayload UX
- `6b3a9ab` docs: Phase 4.1 completion report

مُلحقة هذه الجولة (مُلتزَمة بأرقامها الفعلية):
- `577ea4b` feat(sessions): GET /me cookie-only resume + stale-cookie delete contract
- `d7d3566` test(sessions): /me + delete-cookie integration tests
- `301c207` fix(web): cookie-only restore via /me (no localStorage)
- `238b307` test(web): /me restore flows + no-localStorage assertions
- `660865a` infra(e2e): tracked E2E env + repo harness (seed/specs/run scripts)
- `1b128cc` docs: Phase 4.1 completion report — cookie-only /me, E2E harness in repo

**Final SHA:** `git rev-parse HEAD` = `409f57f` (رأس فرع الإغلاق)
**Git:** `git status --short` فارغ بعد commit التوثيق.

---

## الخطوة التالية

- Phase 5 — التقارير والتصدير: نتائج الجلسات للمعلم، تصدير CSV/Excel، وإحصاءات الأسئلة.
- (اختياري مستقبلًا) Live Mode عبر SignalR (Phase 6) وإدماج سيناريو E2E هذا في دورة تحقق آلية.
