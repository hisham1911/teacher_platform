# E2E — Playwright (Phase 4/4.1 + مسار تسليم Phase 5)

اختبار متصفح حقيقي (Chromium) لجلسة اللاعب عبر كوكي الضيف `tp-guest`، ثم التقارير والاستبانة والشهادة ومشاركة نتيجة ولي الأمر.

**البيئة:** الـ API يُشغَّل بـ`ASPNETCORE_ENVIRONMENT=E2E` — مدارة في Git عبر
`backend/src/TeacherPlatform.Api/appsettings.E2E.json` (لا Secret). قاعدة مخصصة `teacher_platform_e2e`.

## التشغيل

المتطلب المسبق الوحيد للمستودع: قاعدة `teacher_platform_e2e` مُنشأة ومهاجرة (انظر أدناه). السكربت يشغّل `npm ci` للواجهة ولمجلد `e2e/`.

### سطر واحد (يبدأ API + ويب، seed، Part A، يعيد تشغيل API، Part B)

```powershell
.\run-e2e.ps1
```

إذا كانت المنافذ الافتراضية مستخدمة، مرّر منافذ معزولة:

```powershell
.\run-e2e.ps1 -ApiPort 5100 -WebPort 5273
```

> هذا هو المسار الموثّق للتحقق التكراري. لا يوقف السكربت عمليات `dotnet` أو `node` الأخرى؛ ينظف فقط process trees التي بدأها بنفسه. البديل اليدوي أدناه للعزل والتشخيص.

### خطوة بخطوة (بديل يدوي)

```powershell
# 0) إنشاء قاعدة + Migrations
psql -U postgres -c "CREATE DATABASE teacher_platform_e2e;"
$env:ASPNETCORE_ENVIRONMENT = "E2E"
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=teacher_platform_e2e;Username=postgres;Password=postgres"
dotnet ef database update -p ..\backend\src\TeacherPlatform.Infrastructure -s ..\backend\src\TeacherPlatform.Api
Remove-Item Env:ConnectionStrings__DefaultConnection

# تثبيت حتمي من ملفات lock:
npm ci
cd ..\apps\web && npm ci && cd ..\..\e2e

# السطر الواحد:
.\run-e2e.ps1
```

> ملاحظة: `dotnet ef database update` يستخدم `AppDbContextFactory` الذي يقرأ
> `ConnectionStrings__DefaultConnection` من المتغيرات البيئية (وليس `appsettings.E2E.json`)
> — لذا يُمرَّر المتغير صراحةً أعلاه.

- `part-a.spec.mjs`: يثبت كوكي `tp-guest` (HttpOnly + Path=/ + Lax + غير قابل للقراءة من JS)، إجابة + تنقل بين الأسئلة، ثم F5 يستعيد الجلسة عبر `GET /me` عند السؤال الثاني دون شاشة انضمام.
- `part-b.spec.mjs`: يثبت الصمود عبر إعادة تشغيل الـAPI، ثم يغطي مسار النجاح (10/10، PDF، استبانة من ستة أسئلة، رابط ولي الأمر، استعادة النتيجة بعد F5، تقرير المعلم وتصدير CSV) ومسار الرسوب المعزول (0/10 ولا شهادة).

## التنظيف

```powershell
Remove-Item -Recurse -Force .\state.json, .\storage.json, .\test-results, .\playwright-report
Remove-Item -Recurse -Force ..\backend\src\TeacherPlatform.Api\.dev-mail
```
