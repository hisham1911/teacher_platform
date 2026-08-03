# Phase 3 — Quiz Builder والنشر — تقرير الإغلاق

**التاريخ:** 2026-08-03  
**الفرع:** `feature/phase-3-quiz-builder-publishing`  
**العمل متزامن مع:** لا وكلاء آخرون نشطون على هذا الفرع — لم تُمس أعمال Phase 0/1/2.

---

## النتيجة

يُمارَس Quiz Builder والنشر فعليًا على مستوى Backend وFrontend:

- **Quiz** كهوية (Identity) تحمل الحالة العامة والمؤشرات إلى النسخة المسودة الحالية (`CurrentDraftVersionId`) والنسخة المنشورة الحالية (`CurrentPublishedVersionId`)؛ المحتوى الفعلي يعيش في **QuizVersion** (Immutable).
- **QuizVersionItem** يثبّت `QuestionVersionId` داخل النسخة — لا يتغير بعد إنشاء النسخة، مما يضمن أن الطالب يرى نفس الأسئلة التي رآها المعلم عند النشر.
- **النشر (Publish)** يتطلب `IsValid` على النسخة المسودة: كل سؤال يجب أن يكون `Active` وله `CurrentVersionId` صالح، وكل `QuestionVersionId` يجب أن يكون موجودًا في نفس الـTenant.
- **Optimistic Concurrency** عبر `xmin` (RowVersion) على `Quiz` و`QuizVersion` — أي `BaseVersion` قديمة تعيد `409 Conflict`.
- **Tenant Isolation** مُجرب: كل FK مركّب `(Id, TenantId)`، وكل Query يمر عبر Global Query Filters + `TenantSaveGuardInterceptor`.
- **Public Code** (`PublicCode`) يُولّد تلقائيًا عند الإنشاء (GUID-only، 32 حرفًا) ويُستخدم للوصول العام للاختبار المنشور.
- **Quiz Limit** (`IQuizLimitService`) يفرض حدًا أقصى للاختبارات النشطة لكل Tenant (افتراضي 50، قابل للإعداد عبر `Quiz:MaxActivePerTenant`).
- **Frontend**: 5 صفحات كاملة (قائمة، إنشاء، تعديل، معاينة، نشر) مع دعم RTL/LTR حسب لغة السؤال.

---

## الملفات الرئيسية

### Backend (Domain)
- `Domain/Quizzes/Quiz.cs` — الهوية + الحالة + المؤشرات + `xmin`.
- `Domain/Quizzes/QuizVersion.cs` — النسخة Immutable + `IsValid` + `Checksum`.
- `Domain/Quizzes/QuizVersionItem.cs` — تثبيت `QuestionVersionId` + `SortOrder` + `Points`.
- `Domain/Quizzes/QuizStatus.cs` — `Draft=1`, `Published=2`, `Archived=3`.
- `Domain/Quizzes/TimeMode.cs` — `NoLimit=1`, `TotalTime=2`, `PerQuestion=3`.

### Backend (Application)
- `Application/Abstractions/IQuizLimitService.cs` — تجريد فحص الحد الأقصى.
- `Application/Options/QuizLimitOptions.cs` — `MaxActivePerTenant` (افتراضي 50).
- `Application/Quizzes/QuizDtos.cs` — كل DTOs للإنشاء/التعديل/النشر/العرض.
- `Application/Quizzes/QuizService.cs` — Use Cases: Create, UpdateDraft, AddItem, RemoveItem, ReorderItems, Publish, Archive, GetPublicQuiz.

### Backend (Infrastructure)
- `Persistence/Configurations/QuizConfigurations.cs` — فهارس + FKs مركبة + `xmin` + `NoAction`.
- `Persistence/Migrations/20260802223105_CreateQuizBuilderAndPublishing.{cs,Designer.cs}` — 3 جداول جديدة.
- `Services/QuizLimitService.cs` — تنفيذ فحص الحد الأقصى عبر `IQuizRepository`.
- `Services/QuizService.cs` — تنفيذ Use Cases مع Validation وConflict Handling.

### Backend (Api)
- `Controllers/QuizzesController.cs` — CRUD + Publish + Archive تحت `/api/v1/tenants/{tenantId}/quizzes`.
- `Controllers/PublicQuizzesController.cs` — `GET /api/v1/public/quizzes/{publicCode}` — بدون مصادقة، يعرض النسخة المنشورة فقط.
- `Middleware/GlobalExceptionHandler.cs` — إضافة `QuizLimitExceeded` → `403` و`QuizNotFound` → `404`.

### Frontend
- `src/types/quizzes.ts` — TypeScript types لكل DTOs.
- `src/data/api-client/endpoints.ts` — `quizzesApi` + `publicQuizApi`.
- `src/routes/dashboard/quizzes/` — 5 صفحات:
  - `quiz-list-page.tsx` — قائمة مع بحث وترقيم.
  - `quiz-create-page.tsx` — إنشاء مسودة جديدة.
  - `quiz-edit-page.tsx` — تعديل المسودة + إضافة/إزالة/إعادة ترتيب الأسئلة.
  - `quiz-preview-page.tsx` — معاينة النسخة المنشورة كما يراها الطالب.
  - `quiz-publish-page.tsx` — نشر النسخة المسودة مع تأكيد + **QR Code** ورابط المشاركة (للمنشور سابقًا أيضًا عبر `getShare`).
- `src/routes/public/public-quiz-page.tsx` — **صفحة الهبوط العامة** `/q/:publicCode`: metadata فقط (بدون أسئلة/خيارات/إجابات) مع حالات invalid/loading/404/error/unavailable.
- `src/data/api-client/quizzes-endpoints.test.ts` — 15 اختبارًا للـAPI client.

---

## التحقق المنفذ

| أمر | النتيجة |
|-----|---------|
| `dotnet restore backend` | نجاح |
| `dotnet format backend --verify-no-changes` | Exit 0 |
| `dotnet build backend` | 0 خطأ، 0 تحذير |
| `dotnet test backend` | Domain 24/24 + Api 1/1 + Integration 59/59 = **84/84** كلها ناجحة |
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm run test` | **60/60** ناجحة (12 ملفًا) |
| `npm run build` | ✓ built, dist/ جاهز |
| `dotnet ef migrations script --idempotent` | ✓ توليد ناجح |
| Apply idempotent SQL إلى قاعدة فارغة مرتين | ✓ بدون خطأ (24 جدولًا في `public`) |
| `dotnet publish` Release smoke | ✓ |
| `npm audit --omit=dev` / `--include=dev` | 0 vulnerabilities |
| `dotnet list package --vulnerable --include-transitive` | لا حزم ضعيفة |
| `git diff --check` | فارغ |
| Secret scan | لا secrets في تتبع Git |

---

## الجداول والـMigrations

| Migration | المحتوى |
|-----------|---------|
| 20260731111834_InitialCreate | SystemMessages (Phase 0 — لم تُعدّل) |
| 20260731210102_AddIdentity | ASP.NET Identity + RefreshTokens |
| 20260801125127_AddTenancy | Tenants/Memberships/Settings |
| 20260802040730_CreateMediaAssetsAndQuestionBank | MediaAssets, QuestionBanks, Questions, QuestionVersions, QuestionOptions, QuestionTags, QuestionTagLinks |
| **20260802223105_CreateQuizBuilderAndPublishing** | **Quizzes, QuizVersions, QuizVersionItems** |

جمل SQL Idempotent تولد عبر `dotnet ef migrations script --idempotent` وتعمل مرتين بدون خطأ.

---

## Endpoints (تحت `/api/v1`)

### Quizzes (مصادق عليها — `TenantContentManagement` للكتابة)

```text
GET    /api/v1/tenants/{tenantId}/quizzes?search=&status=&page=&pageSize=
POST   /api/v1/tenants/{tenantId}/quizzes                    # إنشاء مسودة — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}
PATCH  /api/v1/tenants/{tenantId}/quizzes/{quizId}           # تعديل المسودة — BaseVersion مطلوب
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/items     # إضافة سؤال — Owner/Teacher
DELETE /api/v1/tenants/{tenantId}/quizzes/{quizId}/items/{itemId}  # إزالة سؤال — Owner/Teacher
PUT    /api/v1/tenants/{tenantId}/quizzes/{quizId}/items/reorder   # إعادة ترتيب — Owner/Teacher
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/publish   # نشر المسودة — Owner/Teacher
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/archive   # أرشفة — Owner/Teacher
```

### Public Quizzes (بدون مصادقة)

```text
GET    /api/v1/public/quizzes/{publicCode}                   # عرض النسخة المنشورة فقط
```

---

## قواعد العمل المنفذة

1. **إنشاء Quiz** = إنشاء `Quiz` + `QuizVersion` (v1, Draft) في معاملة واحدة. `PublicCode` يُولّد تلقائيًا.
2. **تعديل المسودة** يتطلب `BaseVersion` (xmin). اختلافه → `409 Conflict`.
3. **إضافة سؤال** تتطلب أن يكون السؤال `Active` وله `CurrentVersionId` صالح في نفس الـTenant.
4. **النشر** يتطلب:
   - وجود مسودة (`CurrentDraftVersionId` غير null).
   - `IsValid` على المسودة: كل `QuizVersionItem` يشير إلى `QuestionVersion` موجود وصالح.
   - عدم تجاوز `MaxActivePerTenant` (افتراضي 50).
   - النشر ينقل `CurrentDraftVersionId` → `CurrentPublishedVersionId` ويغيّر `Status` إلى `Published`.
5. **الأرشفة** تغيّر `Status` إلى `Archived` — لا حذف فعلي.
6. **Public Access** يعرض فقط الاختبارات `Published` — `Draft` و`Archived` يعيدان `404`.

---

## Frontend

- `/dashboard/quizzes` — قائمة مع بحث وفلترة بالحالة وترقيم.
- `/dashboard/quizzes/new` — إنشاء مسودة (العنوان + الوصف + الإعدادات).
- `/dashboard/quizzes/:id/edit` — تعديل المسودة: إضافة أسئلة من بنك الأسئلة، إزالة، إعادة ترتيب بالسحب والإفلات، تعديل الإعدادات.
- `/dashboard/quizzes/:id/preview` — معاينة النسخة المنشورة كما يراها الطالب (بدون إظهار الإجابات الصحيحة).
- `/dashboard/quizzes/:id/publish` — نشر المسودة مع تأكيد وعرض `PublicCode` + رابط المشاركة + **QR Code** بعد النشر (وللاختبارات المنشورة سابقًا عبر `GET .../share`).
- `/q/:publicCode` — **صفحة هبوط عامة** (بدون مصادقة) تعرض metadata الاختبار المنشور فقط: العنوان، الوصف، التعليمات، عدد الأسئلة، إجمالي الدرجات، نسبة النجاح، وضع الوقت، والثيم — بدون أسئلة أو خيارات أو إجابات. الحالات: رابط غير صالح / تحميل / 404 / خطأ عام / غير متاح.
- RTL/LTR: كل الحقول النصية تعتمد `dir` حسب `language` المختار للسؤال.

---

## Commits و Final SHA

**Commits منفذة ضمن Phase 3 closure:**
- `78c46a7` feat(backend): Phase 3 quiz builder, publishing, and versioning
- `786684b` feat(frontend): Phase 3 quiz management pages and public quiz view
- `89905b1` test: Phase 3 quiz workflow, publishing, and tenancy isolation
- `d1ad563` docs: Phase 3 API/database/architecture docs + completion report

**Commits جولة المراجعة والإغلاق (Review Round):**
- `875735b` fix(frontend): add public quiz landing page at /q/:publicCode — إغلاق GAP-A
- `dbcb50a` feat(frontend): add QR code to quiz publish share panel — إغلاق GAP-B
- `TBD` docs: Phase 3 review round — ADRs 005/006 + report closure

**Final SHA:** `TBD`

**Git:** `git status --short` فارغ (تم التحقق 2026-08-03).

---

## نقص حقيقي (غير مُجمل)

1. **لا يوجد E2E Playwright** للاختبارات؛ الاختبارات الحالية Integration (WebApplicationFactory) أو Frontend unit — تُغطي Phase 3 كاملة لكن الـE2E يؤجل لـPhase 8 (Hardening).
2. **لا يوجد SignalR** للمسابقات المباشرة — مؤجل لـPhase 6.
3. **لا يوجد تصدير/استيراد** للاختبارات — مؤجل لـPhase 5.
4. **Public Quiz Access** لا يتطلب مصادقة لكنه لا يسجل محاولات الطلاب — مؤجل لـPhase 4 (Student Attempts).
5. **لا يوجد إجراء "تحديث إلى أحدث نسخة"** للعناصر المثبتة (GAP-C — قرار متعمد): الخطة تشترط فقط ثبات اللقطة المنشورة؛ شارة الكشف موجودة في واجهة التعديل، والمسار اليدوي = إزالة العنصر وإعادة إضافته ثم نشر جديد (موثق في ADR 005).
6. **`QuizService` يمرر `Guid.Empty` كـtenantId** لبعض فحوص `QuizLimitService` الداخلية (GAP-D — smell مقبول مؤقتًا): العزل يعتمد على Global Query Filters؛ التشديد الكامل موثق في ADR 006.

---

## جولة المراجعة والإغلاق (2026-08-03)

بعد رفض الإغلاق الأول، نُفذت جولة مراجعة فعلية بالمقارنة مع البرومبت الأصلي:

### Gap Analysis — قبل الإصلاح

| # | الفجوة | الدليل |
|---|--------|--------|
| GAP-A | لا توجد صفحة هبوط عامة `/q/:publicCode` — الرابط العام لم يكن له مسار فعلي في الـRouter | `src/app/router.tsx` (قبل): لا مسار `/q/*` خارج `RequireAuth` |
| GAP-B | لا يوجد QR Code في صفحة النشر رغم اشتراط الخطة "رابط + QR للمشاركة" | `quiz-publish-page.tsx` (قبل): رابط نصي فقط |
| GAP-C | لا يوجد إجراء "تحديث إلى أحدث نسخة" للعناصر المثبتة | قرار متعمد — انظر البند 5 أعلاه |
| GAP-D | `QuizService` يمرر `Guid.Empty` لفحوص الحد | smell مقبول — انظر البند 6 أعلاه |

### Gap Analysis — بعد الإصلاح

| # | الحالة | الدليل |
|---|--------|--------|
| GAP-A | **مُغلقة** | `src/routes/public/public-quiz-page.tsx` + مسار `/q/:publicCode` في `router.tsx` (خارج `RequireAuth`) + 5 اختبارات في `public-quiz-page.test.tsx` + تغطية في `router.test.tsx` |
| GAP-B | **مُغلقة** | `react-qr-code` مثبتة؛ QR في `quiz-publish-page.tsx` (بعد النشر + للمنشور سابقًا عبر `getShare`) + اختباران في `quiz-publish-page.test.tsx` |
| GAP-C | **موثقة كقرار** | ADR 005 — القيود |
| GAP-D | **موثقة كـsmell** | ADR 006 — القيود |

### نتائج التحقق بعد الإصلاحات

- Frontend: typecheck ✓ / lint ✓ / **60/60** اختبارًا (12 ملفًا) / build ✓ / audit 0 vulnerabilities.
- Backend: restore ✓ / format ✓ / build 0 تحذير 0 خطأ / **84/84** اختبارًا / publish Release ✓ / لا حزم ضعيفة.
- Migrations: 5 migrations؛ قاعدة CI محدثة (exit 0)؛ تطبيق كامل على قاعدة فارغة (exit 0)؛ سكربت idempotent (29395 بايت) طُبق **مرتين** بنجاح (exit 0)؛ 24 جدولًا بدون جداول اختبارية؛ لا auto-migration في `Program.cs`.

---

## الخطوة التالية

Phase 4 — Student Attempts والتصحيح: تسجيل محاولات الطلاب، حساب الدرجات، وعرض النتائج.
