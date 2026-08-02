# Phase 2 — بنك الأسئلة والوسائط — تقرير الإغلاق

**التاريخ:** 2026-08-02  
**العمل متزامن مع:** وكيل آخر أغلق إصلاحات Phase 1 (67b48bf, 1d9edae) — لم تُمس أعماله.

---

## النتيجة

يُمارَس بنك الأسئلة فعليًا على مستوى Backend وFrontend:

- 5 أنواع أسئلة مسجلة كـ Immutable Versions (إنشاء = v1، وتعديل = إصدار جديد).
- فحص محتوى ملفك صارم: الحجم (5MB صور / 20MB صوت — قابل للإعداد)، الامتداد، وMagic bytes على الطبقة الفعلية، بدون ثقة في اسم الملف أوContent-Type.
- Tenant isolation للملفات والأسئلة مُجرب بجدول مركّب + Middleware + EF Query Filters.
- منطق Conflict عند التعديل المتزامن على نسخة قديمة (BaseVersion → 409).
- Validation خالص في Domain قابل لإعادة الاستخدام في Phase 3 (IsValid للنشر).
- الصلاحيات: قراءة للجميع (أعضاء نشطون)، كتابة Content/Questions للـOwner/Teacher، Assistant محدد بالقراءة فقط في الاختبارات، Viewer مقيد بالقراءة، وOwner فقطلإعدادات/الأعضاء.
- Frontend: 5 routes للأسئلة/البنوك/ الإصدارات/المعاينة/التعديل، مع ملء Options Ordering وTrueFalse وShortAnswer والاستماع بصورة صحيحة.

---

## الملفات الرئيسية

### Backend (Domain)
- `Domain/Media/MediaAsset.cs`
- `Domain/Questions/{QuestionBank,Question,QuestionVersion,QuestionOption,QuestionTag}.cs`
- `Domain/Questions/Validation/QuestionValidator.cs` — خالص، بلا I/O.

### Backend (Application)
- `Application/Abstractions/IObjectStorage.cs`
- `Application/Options/StorageOptions.cs`
- `Application/Media/{MediaDtos,MediaFileValidator}.cs`
- `Application/Questions/QuestionDtos.cs`

### Backend (Infrastructure)
- `Persistence/AppDbContext.cs` — DbSets الجديدة + ApplyConfigurations.
- `Persistence/Configurations/MediaAndQuestionConfigurations.cs` — فهارس+FKs مركبة+xmin (RowVersion) + NoAction بدون cascade.
- `Persistence/Migrations/20260802040730_CreateMediaAssetsAndQuestionBank.cs` (+Designer).
- `Services/LocalObjectStorage.cs` (Development/Testing) + `Services/S3ObjectStorage.cs` (fail-fast إنتاجي حتى توفر SDK).
- `Services/MediaService.cs` — upload validation + persistence.
- `Services/QuestionService.cs` — Use Cases بما فيها Versioning والـConflict.

### Backend (Api)
- Controllers: `QuestionBanksController`, `QuestionsController`, `QuestionTagsController`, `TenantMediaController`.
- `Authorization/AuthorizationPolicies.cs` + `TenantRoleHandler.cs` — سياسة `TenantContentManagement` (Owner/Teacher).
- `Middleware/GlobalExceptionHandler.cs` — 409 Conflict و413 FileTooLarge mappings.
- `Program.cs` — تسجيل Storage options مع فشل مبكر لـS3 بدون بيانات اعتماد.

### Frontend
- `src/types/questions.ts`
- `src/data/api-client/endpoints.ts` — callBlob/callMultipart + questionBanksApi/tags/questions/media.
- `src/features/questions/{question-form,media-content-preview,question-draft-validation}.tsx/.ts`
- `src/routes/dashboard/questions/*` 5 صفحات.
- `src/app/router.tsx` + `components/layout/root-layout.tsx` — إدخالات أصغرية فقط.

### CI
- لا تغييرات مطلوبة في `.github/workflows/ci-foundation.yml` — نفس خطوات Phase 1 تغطي Backend/Frontend tests وMigrations script audit وPackage vulnerability audit تلقائيًا مع الكود الجديد.

---

## التحقق المنفذ

| أمر | النتيجة |
|-----|---------|
| `dotnet restore backend` | نجاح |
| `dotnet format backend --verify-no-changes` | Exit 0 |
| `dotnet build backend` | 0 خطأ، 0 تحذير |
| `dotnet test backend` | Domain 24/24 + Api 1/1 + Integration 39/39 = 64 كلها ناجحة |
| `npm run lint` | ناجح |
| `npm run typecheck` | ناجح |
| `npm run test` | 37/37 ناجحة |
| `npm run build` | ✓ built, dist/ جاهز |
| `dotnet ef migrations script --idempotent` | ✓ توليد ناجح |
| Apply idempotent SQL إلى قاعدة فارغة مرتين | ✓ بدون خطأ (21 جدولًا في `public`) |
| `dotnet publish` Release smoke | ✓ |
| `npm audit --omit=dev` / `--include=dev` | 0 vulnerabilities |
| `dotnet list package --vulnerable --include-transitive` | لا حزم ضعيفة |
| `git diff --check` | فارغ |
| Secret scan | لا secrets في تتبع Git |

## الجداول والMigrations

| Migration | المحتوى |
|-----------|---------|
| 20260731111834_InitialCreate | SystemMessages (Phase 0 — لم تُعدّل) |
| 20260731210102_AddIdentity | ASP.NET Identity + RefreshTokens |
| 20260801125127_AddTenancy | Tenants/Memberships/Settings |
| **20260802040730_CreateMediaAssetsAndQuestionBank** | MediaAssets, QuestionBanks, Questions, QuestionVersions, QuestionOptions, QuestionTags, QuestionTagLinks |

جمل SQL Idempotent تولد عبر `dotnet ef migrations script --idempotent` وتعمل مرتين بدون خطأ.

## Endpoints (تحت `/api/v1/tenants/{tenantId}`)

- `GET /question-banks`, `POST /question-banks` (Owner/Teacher), `PATCH /question-banks/{bankId}`
- `GET /question-tags`
- `GET /questions` — search/type/difficulty/tag/includeArchived/pagination
- `POST /questions` — إنشاء v1 (Owner/Teacher)
- `GET /questions/{questionId}`
- `GET /questions/{questionId}/versions` + `GET /questions/{questionId}/versions/{versionNumber}`
- `POST /questions/{questionId}/versions` — BaseVersion مطلوب، mismatch → `409`
- `POST /questions/{questionId}/archive` — إخفاء بدون حذف
- `POST /media` (multipart) + `GET /media/{mediaId}` + `GET /media/{mediaId}/content`

## أنواع الأسئلة المنفذة

1. اختيار من متعدد: 2..10 خيارات، إجابة صحيحة واحدة بدقة.
2. صح/خطأ: خياران ثابتان مع إجابة صحيحة واحدة.
3. إجابة قصيرة/إكمال فراغ: `acceptedAnswers[]` في ConfigJson، بدون options.
4. ترتيب عناصر: 2..10 عناصر؛ إدخالها بالترتيب الصحيح هو الإجابة المعيارية.
5. استماع: نفس MC لكن مع `mediaAssetId` من Kind=Audio إلزامي.

## Storage

- `IObjectStorage` تجريد واحد بأربع عمليات.
- Local storage يحفظ في `.media-storage/` (Git-ignored) ويحمي من تجاوز المسار.
- S3 implementation scaffold موجود مع ValidateOnStart forcing credentials — لا يعمل حتى اختيار AWSSDK.
- الروابط للواجهة تبنى كـ`/api/v1/.../media/{id}/content` بعد تحقق Middleware — لا ObjectKey ولا Signed URLs دائمة.

## Frontend

- `/dashboard/questions` — قائمة مع **بحث** و(بنك/نوع/صعوبة/وسم) وترقيم، إضافة بنك inline، وأنوان Empty State بدون أي بيانات وهمية.
- `/dashboard/questions/new` — إنشاء مع استبدال نوع السؤال، رفع صورة/صوت مع Preview عبر Blob (لأن `<img>/<audio>` لا ترسل Authorization)، ومنع upload غير صالح مبكرًا.
- `/dashboard/questions/:id/edit` — يستخدم BaseVersion (xmin)، يعرض `409` رسالة بالعربية عند تعارض التعديل المتزامن مع زر Reload.
- `/dashboard/questions/:id/preview` — renders current version visible الطالب صحيحًا، مع إخفاء حالة الإجابة الصحيحة عمدًا.
- `/dashboard/questions/:id/versions` — Timeline صالح/غير صالح تواريخيًا.
- RTL/LTR: كل الحقول النصية تعتمد `dir` حسب `language` المختار للسؤال.

## Commits و Final SHA

**Commits منفذة ضمن Phase 2 closure:**
- `bcce058` feat(backend): Phase 2 question bank, media storage, and versioning
- `78f70ad` feat(frontend): Phase 2 question management pages and media preview
- `04cf5e2` test: Phase 2 question validation, media upload, versioning and tenancy isolation
- `8f651d4` docs: Phase 2 openAPI/database/development docs and ADRs + completion report

**Commits إغلاق إضافية لحالة نظيفة (تبقّى من الوكيل الآخر ولم تُدخل في 67b/1d9):**
- `18c624a` fix(backend): UrlEncode email action links and add plain-text dev mail output
- `9d614a5` chore(frontend): lock @vitejs/plugin-react-swc dependency and proxy dev config

**Final SHA:** `9d614a51b2353dd7cc3e95bb608bdc00e8f7ffd7`

**Git:** `git status --short` فارغ (تم التحقق 2026-08-03T00:32).

## التغييرات التي لاحظتها من وكيل آخر

- Commit `67b48bf`: إصلاح النصوص العربية المشوهة ورابط Dev Mail — يتضمن الجزء الأكبر ضمن untrack. **أي بقايا (AuthService/FileEmailSender)** التي لم تدخل الـcommit ذاته التُزمت هنا في `18c624a` لأنها مطلوبة لنفس الإصلاح.
- Commit `1d9edae`: استمرار session بعد F5/restart. **أي بقايا (package.json/package-lock.json/vite.config.ts)** المطلوبة لهذا الإصلاح التُزمت في `9d614a5`.
- نتيجة: Worktree نظيف وFinal SHA يمثّل حالة يمكن إعادة بنائها من الـCommits فقط.

## نقص حقيقي (غير مُجمل)

1. **S3ObjectStorage**: Fail-fast scaffold بلا كود S3 حقيقي — يجب تثبيت AWSSDK.S3 وتفعيله قبل Production، وواضح للغاية لذلك InvalidOperationException في وقت الإنشاء.
2. **Media orphan cleanup**: لا Job ينظف ملفات غير المرتبطة بأي سؤال فعلي — مطلوب لاحقًا عند أول ضغط تخزين.
3. **Duplicated code in endpoints.ts** تم التعامل معه خلال التنFederating؛ الصفحة الحالية لا تحمل duplicate definitions.
4. لا يوجد E2E Playwright للأسئلة؛ الاختبارات الحالية إمّا Integration (WebApplicationFactory) أو Frontend unit — تُغطي Phase 2 كاملة لكن ال E2E يؤجل لـPhase 8 (Hardening).
5. English question content directions مدعومة عبر `language='en'` لكن Selector UI بالعربية فقط كما تخطط الخطة (واجهة المعلم عربية).

## الخطوة التالية

Phase 3 — Quiz Builder والنشر: تثبيت QuestionVersionId داخل QuizVersionItem مع `IsValid` كـ prerequisite للنشر.
