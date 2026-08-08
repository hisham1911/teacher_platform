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
4. **تشغيل كل أدوات التحقق** وإصدار تقرير الإغلاق.

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
  - **إصلاح اكتشفه E2E:** بعد إنهاء المحاولة ثم F5 كانت الصفحة تعود لشاشة الانضمام وتفقد النتيجة. الحل: حفظ اسم الطالب في `localStorage` وإعادة ربط تلقائية عند التحميل — الـ`join` يعيد تحديد الوجهة من حالة الخادم الفعلية (استئناف / بدء / نتيجة منتهية). لا تُخزَّن أي Tokens (التزام AGENTS.md).
- **E2E Playwright في Chromium حقيقي** (Part A + Part B) مع إعادة تشغيل فعلية للـAPI بينهما.

---

## التحقق المنفذ

| أمر | النتيجة |
|-----|---------|
| `dotnet format --verify-no-changes` | Exit 0 |
| `dotnet build` | 0 خطأ، 0 تحذير |
| `dotnet test` (INTEGRATION_TEST_DB) | Domain **62/62** + Api **1/1** + Integration **88/88** = **151/151** |
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm run test` | **76/76** (14 ملفًا) |
| `npm run build` | ✓ built |
| Playwright E2E (Chromium 151) | Part A ✓ + Part B ✓ (مرتان متتاليتان) |

### اختبارات جديدة في الجولة
- `AnswerPayloadValidatorTests` (12، Domain) — قواعد الأنواع الخمسة + الحواف (GUID أجنبي/تكراري/ناقص، JSON فاسد، نص فارغ، أنواع مفتاح خاطئة).
- `PlayerAnswerValidationTests` (3، PostgreSQL حقيقي) — حمولة فاسدة → 400 بلا تقدم؛ صالحة-لكن-خاطئة → 200/صفر؛ Idempotency/409 محفوظان.
- `GuestCookieTests` (2، PostgreSQL حقيقي) — عقد `Set-Cookie` في Dev (`tp-guest`: Path=/، Lax، Secure=false) والـ Prod (`__Host-tp-guest`: Secure، HttpOnly، SameSite=Lax).
- `play-page.test.tsx` (11، +3 جديدة) — إعادة ربط تلقائية تستأنف محاولة جارية، استعادة نتيجة منتهية مباشرة بعد F5، وإعادة محاولة بعد `InvalidAnswerPayload`.

---

## E2E الحقيقي (Chromium)

**السيناريو الكامل** على `http://localhost:5173/play/{joinCode}` مع API على `http://localhost:5000`:

1. **Part A:** انضمام باسم → بدء → إجابة السؤال الأول (صح) → إثبات الكوكي في Chromium:
   - `tp-guest` موجود، `httpOnly=true`، `path=/`، `secure=false`، `sameSite=Lax`.
   - `document.cookie` من JS **لا تحتويه**.
   - F5 → إعادة ربط تلقائية → استئناف مباشر عند السؤال الثاني (لا شاشة انضمام).
2. **إيقاف API وإعادة تشغيله فعليًا** (صفر فقدان — كل شيء في PostgreSQL).
3. **Part B:** نفس جلسة المتصفح (كوكي + localStorage محفوظان) → استئناف عند السؤال الثاني → إجابة الأخير → إنهاء → **10/10 · 100% · ناجح ✓** → F5 على صفحة النتيجة → **تستعاد النتيجة تلقائيًا** (لا شاشة انضمام/استعداد).

السيناريو يجمع في جولة واحدة: عقد الكوكي، استمرارية المتصفح عبر F5، واستمرارية الخادم عبر إعادة تشغيله.

---

## اكتشافات وأسباب (Bugs/Findings)

1. **F5 بعد الإنهاء يفقد النتيجة (UX bug):** الجلسة تبقى `Active` بعد انتهاء محاولة المشارك، فكانت الصفحة بعد التحديث تعيد شاشة الانضمام وتتطلب إعادة انضمام + استئناف لرؤية النتيجة. أُصلح بإعادة الربط التلقائية (للمحاولة الجارية والمنتهية على حد سواء).
2. **تقييد المعدل على localhost يكسر E2E (بيئة، لا كود):** `PlayerEndpoints` بـ`RateLimiting: 20/60s` لكل IP؛ كل حركة E2E تتشارك `127.0.0.1` فكان التقييد يعيد `429` بلا جسم على الإجابات ثم على `getSession`. أثبت ذلك من Trace المتصفح (POST answers → 429). **الحل:** رفع حد التطوير فقط إلى `200/60s` في `appsettings.Development.json` (ملف مُستثنى من Git لاحتوائه كلمة سر Dev DB) — الإنتاج يبقى 20/60s كما هو في `appsettings.Example.json`. سلوك «المحاولات كثيرة» في الواجهة يعمل (اللاعب يرى رسالة واضحة ويستطيع إعادة المحاولة لاحقًا).

---

## إعدادات محلية (غير مُلتزَمة)

- `backend/src/TeacherPlatform.Api/appsettings.Development.json` — `RateLimiting.PermitLimit: 200` (لتمكين E2E الآلي على localhost). لا يُعرَّف في Git حفاظًا على سرية كلمة سر قاعدة التطوير.
- سكربتات/حالة E2E في `%TEMP%\opencode\e2e\` خارج المستودع (seed.mjs، part-a/part-b، storage.json، run-api.cmd).

---

## Commits و Final SHA

- `8bba342` feat(sessions): strict answer payload validation -> 400 InvalidAnswerPayload
- `7d3e6bd` test(sessions): answer payload validation + guest cookie contract tests
- `b8a02bf` fix(player): auto-restore attempt/result on refresh + InvalidAnswerPayload UX
- `d615cdd` docs: Phase 4.1 completion report (commit التوثيق النهائي)

**Final SHA:** يُؤخذ من `git rev-parse HEAD` بعد commit التوثيق.

**Git:** `git status --short` فارغ بعد commit التوثيق.

---

## الخطوة التالية

- Phase 5 — التقارير والتصدير: نتائج الجلسات للمعلم، تصدير CSV/Excel، وإحصاءات الأسئلة.
- (اختياري مستقبلًا) Live Mode عبر SignalR (Phase 6) وإدماج سيناريو E2E هذا في دورة تحقق آلية.
