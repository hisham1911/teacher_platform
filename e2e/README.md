# E2E — Playwright (Phase 4/4.1: جلسات اللاعبين وتحسين المتصفح)

اختبار متصفح حقيقي (Chromium) لجلسة اللاعب عبر كوكي الضيف `tp-guest`.

**البيئة:** الـ API يُشغَّل بـ`ASPNETCORE_ENVIRONMENT=E2E` — مدارة في Git عبر
`backend/src/TeacherPlatform.Api/appsettings.E2E.json` (لا Secret). قاعدة مخصصة `teacher_platform_e2e`.

## التشغيل

متطلب مسبق: قاعدة `teacher_platform_e2e` مُنشأة ومهاجرة (انظر أدناه) وواجهة `npm ci` جاهزة.

### سطر واحد (يبدأ API + ويب، seed، Part A، يعيد تشغيل API، Part B)

```powershell
.\run-e2e.ps1
```

> هذا هو المسار الموثّق للتحقق التكراري. البديل اليدوي أدناه للعزل/التفكير.

### خطوة بخطوة (بديل يدوي)

```powershell
# 0) إنشاء قاعدة + Migrations
psql -U postgres -c "CREATE DATABASE teacher_platform_e2e;"
$env:ASPNETCORE_ENVIRONMENT = "E2E"
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=teacher_platform_e2e;Username=postgres;Password=postgres"
dotnet ef database update -p ..\backend\src\TeacherPlatform.Infrastructure -s ..\backend\src\TeacherPlatform.Api
Remove-Item Env:ConnectionStrings__DefaultConnection

# متطلب أساسي (مرة واحدة):
npm install                     # تثبيت Playwright في هذا المجلد
cd ..\apps\web && npm install && cd ..\..\e2e

# السطر الواحد:
.\run-e2e.ps1
```

> ملاحظة: `dotnet ef database update` يستخدم `AppDbContextFactory` الذي يقرأ
> `ConnectionStrings__DefaultConnection` من المتغيرات البيئية (وليس `appsettings.E2E.json`)
> — لذا يُمرَّر المتغير صراحةً أعلاه.

- `part-a.spec.mjs`: يثبت كوكي `tp-guest` (HttpOnly + Path=/ + Lax + غير قابل للقراءة من JS)، إجابة + تنقل بين الأسئلة، ثم F5 يستعيد الجلسة عبر `GET /me` عند السؤال الثاني دون شاشة انضمام.
- `part-b.spec.mjs`: يثبت الصمود عبر إعادة تشغيل الـAPI، وإكمال المحاولة، واستعادة النتيجة عبر F5.

## التنظيف

```powershell
Remove-Item -Recurse -Force .\state.json, .\storage.json, .\test-results, .\playwright-report
Remove-Item -Recurse -Force ..\backend\src\TeacherPlatform.Api\.dev-mail
```
