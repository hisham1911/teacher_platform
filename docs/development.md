# دليل التطوير

## المتطلبات

- Node.js 24+ و npm.
- .NET SDK 10.0.x.
- PostgreSQL 15 أو أحدث (خدمة محلية أو أي قاعدة تطوير متاحة). لا يشترط Docker.
- أداة `dotnet-ef` عالمية: `dotnet tool install -g dotnet-ef`.

## البنية

```text
apps/web/    # React 19 + Vite + TypeScript (SPA)
backend/     # ASP.NET Core Web API (.NET 10) + EF Core + PostgreSQL
docs/        # معمارية + تشغيل + قرارات
```

## 1. الإعداد الأول

### الواجهة

```bash
cd apps/web
cp .env.example .env.development.local   # أو أنشئ .env.local بنفس الاسم
npm install
```

`VITE_API_BASE_URL` افتراضيًا `http://localhost:5000`.

### الباك إند

1. أنشئ قاعدة بيانات تطوير فارغة (مثال: `teacher_platform_dev`) ومستخدمًا مخصصًا.
2. ضع Connection String في **بيئة المستخدم** أو في `appsettings.Development.json` (مستبعد من Git عبر النسخة المثبتة محليًا — القالب النظيف في `appsettings.Example.json`):

```text
Host=localhost;Port=5432;Database=teacher_platform_dev;Username=teacher_dev;Password=***
```

3. طبّق الـ Migrations:

```bash
dotnet ef database update -p src/TeacherPlatform.Infrastructure -s src/TeacherPlatform.Api
```

## 2. التشغيل

### API

```bash
cd backend
dotnet run --project src/TeacherPlatform.Api --urls http://localhost:5000
```

- OpenAPI: http://localhost:5000/openapi/v1.json (بيئة Development فقط)
- Liveness: http://localhost:5000/health/live
- Readiness: http://localhost:5000/health/ready (يفحص الاتصال بقاعدة البيانات)
- Endpoint تجريبي: http://localhost:5000/api/v1/system/info

### الواجهة

```bash
cd apps/web
npm run dev        # http://localhost:5173
```

تتواصل الواجهة مع الـ API عبر `VITE_API_BASE_URL`، وCORS مهيأ لاستقبال `http://localhost:5173`.

## 3. فحوص الجودة

### الواجهة (من apps/web)

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

- `npm run preview` لتشغيل ناتج `dist` محليًا والتحقق أن `/dashboard` و`/play/{joinCode}` يعملان عند الفتح المباشر والتحديث؛ استخدم `JoinCode` من جلسة فعالة.

### الباك إند (من backend)

```bash
dotnet restore
dotnet format --verify-no-changes
dotnet build
dotnet test
```

- `dotnet test` يشمل: Domain.Tests و Api.Tests (WebApplicationFactory) و IntegrationTests (Auth Flow + Tenancy على PostgreSQL حقيقية).
- اختبارات Integration تحتاج PostgreSQL متاحة. في CI تعمل عبر service container؛ محليًا شغّل PostgreSQL واضبط:
  - `INTEGRATION_TEST_DB=Host=localhost;Port=5432;Database=teacher_platform_test;Username=postgres;Password=postgres`
  - ثم `dotnet test tests/TeacherPlatform.IntegrationTests`
- عند أول تشغيل محلي: قاعدة الاختبار تُنشأ تلقائيًا عبر الاختبار نفسه (لا حاجة لإنشائها يدويًا).

##         4. Migrations

```bash
# إنشاء Migration جديدة
dotnet ef migrations add <Name> -p src/TeacherPlatform.Infrastructure -s src/TeacherPlatform.Api

# تطبيق على قاعدة التطوير
dotnet ef database update -p src/TeacherPlatform.Infrastructure -s src/TeacherPlatform.Api

# توليد SQL للمراجعة قبل الإنتاج
dotnet ef migrations script -p src/TeacherPlatform.Infrastructure -s src/TeacherPlatform.Api --idempotent
```

قواعد صارمة:

- لا تعدّل Migration بعد تطبيقها على بيئة مشتركة.
- راجع الـ SQL الناتج قبل أي نشر.
- لا `Database.Migrate()` تلقائي عند تشغيل الأحداث في Production.

## 5. تشغيل Phase 1 كاملة (Identity + Tenancy + Frontend)

### تشغيل PostgreSQL محليًا

```powershell
# تنزيل وتشغيل PostgreSQL 15 (native, لا Docker إلزامي)
# بعد التثبيت: أنشئ قاعدة التطوير والاختبار
psql -U postgres -c "CREATE DATABASE teacher_platform_dev;"
psql -U postgres -c "CREATE DATABASE teacher_platform_test;"
```

أو عبر Docker للتطوير فقط:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### API (Backend)

```bash
cd backend
dotnet ef database update -p src/TeacherPlatform.Infrastructure -s src/TeacherPlatform.Api
dotnet run --project src/TeacherPlatform.Api --urls http://localhost:5000
```

- OpenAPI: http://localhost:5000/openapi/v1.json
- Liveness: http://localhost:5000/health/live

### الواجهة

```bash
cd apps/web
npm run dev
```
- ثم افتح `http://localhost:5173`.
- سجّل مستخدمًا; اذهب إلى Onboarding ثم Dashboard.

### تجربة تدفق الهوية الكامل يدوياً

```bash
# Register (Email confirmation تُلتقط في .test-mail/)
curl -X POST http://localhost:5000/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"t@example.com","password":"SecurePassword123!","fullName":"Test User"}'
# ثم Login:
curl -X POST http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"t@example.com","password":"SecurePassword123!"}' -i
# ثم /me مع Authorization: Bearer <access-token>
curl http://localhost:5000/api/v1/auth/me -H "Authorization: Bearer <access-token>"
```

### Phase 2 — Media و Question Bank

- التخزين المحلي يكتب تحت `backend/src/TeacherPlatform.Api/.media-storage/` (مستبعد Git) افتراضيًا. مسارات تنظيفه عند إعادة الضبط:
  - Development: `Remove-Item -Recurse -Force backend/src/TeacherPlatform.Api/.media-storage` (بلا ضرر).
  - Testing: المجلد `.test-media-storage`؛ يعاد تهيئته عند كل تشغيل جديد من WebApplicationFactory.
- رفع ملف من curl (مع توكن صالح ومعرف مستأجر حقيقي):

```bash
curl -i -X POST http://localhost:5000/api/v1/tenants/{tenantId}/media \
  -H "Authorization: Bearer <access-token>" \
  -H "X-Tenant-Id: {tenantId}" \
  -F "file=@/path/to/image.png;type=image/png"
```

- بنك أسئلة ثم سؤال اختيار متعدد:

```bash
curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/question-banks \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}" \
  -H "Content-Type: application/json" -d '{"name":"General"}'

curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/questions \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}" \
  -H "Content-Type: application/json" \
  -d '{"bankId":"<bank-guid>","questionType":"MultipleChoice","prompt":"ما عاصمة مصر؟","options":[{"text":"القاهرة","isCorrect":true},{"text":"عمان","isCorrect":false}]}'
```

- إنشاء نسخة جديدة باستخدام baseVersion الحالي من `GET /questions/{id}`:

```bash
curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/questions/{questionId}/versions \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"النص الجديد","options":[{"text":"A","isCorrect":true},{"text":"B","isCorrect":false}],"baseVersion":<xmin-number>}'
```

### Phase 3 — Quiz Builder والنشر

- إنشاء اختبار (مسودة) ثم إضافة سؤال إليه ثم نشره:

```bash
# إنشاء
curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/quizzes \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}" \
  -H "Content-Type: application/json" \
  -d '{"title":"اختبار الوحدة الأولى","timeMode":"NoLimit","passingPercentage":60}'

# إضافة سؤال (questionId من Phase 2)
curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}" \
  -H "Content-Type: application/json" \
  -d '{"questionId":"<question-guid>","points":10}'

# نشر
curl -X POST http://localhost:5000/api/v1/tenants/{tenantId}/quizzes/{quizId}/publish \
  -H "Authorization: Bearer <access-token>" -H "X-Tenant-Id: {tenantId}"
# الاستجابة تحمل publicCode و shareUrl (/q/{publicCode})
```

- الوصول العام (بدون مصادقة): `GET /api/v1/public/quizzes/{publicCode}` — metadata فقط (لا أسئلة/خيارات/إجابات). صفحة الهبوط في الواجهة: `http://localhost:5173/q/{publicCode}`.
- حدود الاستخدام: `QuizLimits:MaxQuizzesPerTenant` (افتراضي 100) للاختبارات غير المؤرشفة، و`MaxQuestionsPerQuiz` (افتراضي 200)، و`MaxPublishedQuizzesPerTenant` (افتراضي 50). التجاوز يعيد `403 QuotaExceeded`، والأرشفة تحرر السعة المناسبة.
- تعديل المسودة يتطلب `baseVersion` (xmin) من آخر قراءة؛ الاختلاف يعيد `409 Conflict`.
- صفحة النشر في الواجهة تعرض رابط المشاركة + QR Code بعد النشر (وللمنشور سابقًا عبر `GET .../share`).


## 6. إعداد Testing لبيئة WebApplicationFactory

- يُملي `TestWebApplicationFactory` البيئة `Testing` مسبقًا.
- يحمّل `appsettings.Testing.json` تلقائيًا من مجلد الـAPI (CopyToOutputDirectory) → يحمل كل الـJWT/Auth/Lockout/Mail/RateLimit/CORS.
- التعديلات الوحيدة المباشرة: `DataProtection__KeysDirectory` مسارات صياملة مؤقتة معزولة لكل factory، و`ConnectionStrings__DefaultConnection` من env.
- لا يتم تعطيل `ValidateOnStart` ولا أي قيود أمنية للاختبار.

## 7. نشر Vercel (الواجهة فقط)

- Build command: `npm run build` من `apps/web`؛ Output: `dist`.
- `vercel.json` يتضمن SPA fallback (rewrite إلى index.html) ولا يمرر `/api` إلى Vercel — عنوان الـ API يأتي من `VITE_API_BASE_URL`.
- ممنوع استخدام Vercel Functions؛ كل المنطق في ASP.NET Core.

## 8. E2E بالمتصفح (Playwright)

قابلة للتكرار على clean clone عبر بيئة `E2E` مدارة في Git (عكس بيئة `Development` المستبعدة بكلمة سر قاعدة محلية). كل الأدوات في `e2e/` بالمستودع (seed.mjs + specs + run scripts + README).

### التشغيل

1. أنشئ قاعدة `teacher_platform_e2e` وطبّق الـ Migrations مع `ASPNETCORE_ENVIRONMENT=E2E`
   (ملاحظة: `dotnet ef` يقرأ Connection String من متغير `ConnectionStrings__DefaultConnection` وليس من `appsettings.E2E.json`):

```powershell
$env:ASPNETCORE_ENVIRONMENT = "E2E"
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=teacher_platform_e2e;Username=postgres;Password=postgres"
Remove-Item -Recurse -Force backend/src/TeacherPlatform.Api/.dev-mail* -ErrorAction SilentlyContinue
psql -U postgres -c "CREATE DATABASE teacher_platform_e2e;"
dotnet ef database update -p backend/src/TeacherPlatform.Infrastructure -s backend/src/TeacherPlatform.Api
Remove-Item Env:ConnectionStrings__DefaultConnection
```

2. شغّل المشهد كاملًا بسطر واحد من `e2e/` (يبدأ API ببيئة `E2E` + الواجهة + seed + Part A + إعادة تشغيل حقيقية للـAPI + Part B + Live Part C):

```powershell
cd e2e
npm ci
.\run-e2e.ps1
```

السكربت يشغّل `npm ci` أيضًا داخل `apps/web`، ولا يوقف إلا process trees التي بدأها. عند انشغال المنافذ الافتراضية استخدم مثلًا:

```powershell
.\run-e2e.ps1 -ApiPort 5100 -WebPort 5273
```

3. البديل اليدوي (لتشخيص/عزل): شغّل `e2e/run-api.cmd` (يثبّت بيئة `E2E` تلقائيًا) ثم `e2e/run-web.cmd`، ثم `node e2e\seed.mjs`، ثم specs بالترتيب `part-a`, `part-b`, `part-c-live`. بعد seed سابق يمكن عزل Live فقط عبر `.\run-e2e.ps1 -Stage live`.

- بيئة `E2E` مصممة بحيث: `UseSecureCookie=false` (كوكي `tp-guest` على localhost بدون secure)، `RateLimiting.PermitLimit=200` (لا يخل بجريان الأتمتة)، وقاعدة متميزة عن التطوير والاختبار.
- Part A يغطي الاستعادة server-side بعد F5. Part B يغطي النجاح والشهادة وPDF والاستبانة ومشاركة ولي الأمر وتقرير المعلم وCSV، إضافة إلى رسوب معزول بلا شهادة.
- Part C يفتح Host ولاعبًا في سياقين منفصلين، ويتحقق من الانتقالات والـLeaderboard وإخفاء الصحة/الدرجة حتى إغلاق السؤال واستعادة نتيجة Live بعد F5.
- التشغيل والتنظيف مفصّلان في `e2e/README.md`.

### إعدادات Live المحلية

قسم `Session` يضبط `LiveDefaultQuestionSeconds` (5..300)، و`LiveTokenMinutes` (1..30)، و`LiveMonitorIntervalSeconds` (1..10)، إلى جانب `GraceWindowSeconds`. القيم المتتبعة في `appsettings.Example.json` و`appsettings.E2E.json` أمثلة غير سرية. اتصال SignalR يستخدم `${VITE_API_BASE_URL}/hubs/quiz` ويحتاج WebSocket proxy في Production؛ polling الدوري يبقى fallback في الواجهة.

## 9. متطلبات تشغيل الشهادات

- يجب اختيار `Certificates:QuestPdfLicense` صراحةً في Production (`Community` أو `Professional` أو `Enterprise`) بعد التحقق القانوني من أهلية الترخيص؛ التطبيق يفشل عند غياب الاختيار.
- الخط الافتراضي على Windows هو `Arial` وعلى Linux هو `DejaVu Sans`. ثبّت حزمة الخط المناسبة (مثل `fonts-dejavu-core`) أو اضبط اسم عائلة متاحة عبر `Certificates:LinuxFontFamily`.
- لأن `PublicTokenProtected` يعتمد ASP.NET Core Data Protection، استخدم `DataProtection:KeysDirectory` دائمًا خارج release directory وعلى تخزين دائم في Production.
- `Storage:Provider=Local` مناسب للتطوير/E2E فقط. محول S3 الحالي fail-fast وغير منفذ؛ لا تضبط `Provider=S3` في Production قبل توصيل SDK وSecret store واختبار القراءة/الكتابة. هذا قيد تسليم مسجل للمرحلة اللاحقة.

## حل المشاكل

- فشل الاتصال بقاعدة البيانات: تأكد أن PostgreSQL يعمل وأن الـ Connection String صحيح، وراجع `/health/ready` (يرجع 503 عند الفشل).
- الترحيل `dotnet-ef` older than runtime: حدث الأداة `dotnet tool update -g dotnet-ef`.
- تجنّب طباعة أي Secret في الطرفية أو السجلات.
