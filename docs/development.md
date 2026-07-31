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

- `npm run preview` لتشغيل ناتج `dist` محليًا والتحقق أن `/dashboard` و`/play/demo` يعملان عند الفتح المباشر والتحديث.

### الباك إند (من backend)

```bash
dotnet restore
dotnet format --verify-no-changes
dotnet build
dotnet test
```

- `dotnet test` يشمل: Domain.Tests و Api.Tests (WebApplicationFactory) و IntegrationTests (Migrations على PostgreSQL حقيقية).
- اختبارات Integration تحتاج PostgreSQL متاحة. في CI تعمل عبر service container؛ محليًا اضبط الـ Connection String أو شغّل قاعدة `teacher_platform_test`.

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

## 5. نشر Vercel (الواجهة فقط)

- Build command: `npm run build` من `apps/web`؛ Output: `dist`.
- `vercel.json` يتضمن SPA fallback (rewrite إلى index.html) ولا يمرر `/api` إلى Vercel — عنوان الـ API يأتي من `VITE_API_BASE_URL`.
- ممنوع استخدام Vercel Functions؛ كل المنطق في ASP.NET Core.

## حل المشاكل

- فشل الاتصال بقاعدة البيانات: تأكد أن PostgreSQL يعمل وأن الـ Connection String صحيح، وراجع `/health/ready` (يرجع 503 عند الفشل).
- الترحيل `dotnet-ef` older than runtime: حدث الأداة `dotnet tool update -g dotnet-ef`.
- تجنّب طباعة أي Secret في الطرفية أو السجلات.
