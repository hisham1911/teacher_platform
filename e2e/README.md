# E2E — Playwright

اختبارات متصفح حقيقية (Chromium) للمسارات الأساسية في المنصة: بناء المحتوى، مسار English Spark المبسّط للمعلمة، اللاعب الفردي، التحدي المتدرج، الاستعادة بعد restart، المسابقة المباشرة، التقارير والاستبانة والشهادة ومشاركة نتيجة ولي الأمر.

**البيئة:** الـ API يُشغَّل بـ`ASPNETCORE_ENVIRONMENT=E2E` — مدارة في Git عبر
`backend/src/TeacherPlatform.Api/appsettings.E2E.json` (لا Secret). قاعدة مخصصة `teacher_platform_e2e`.

## التشغيل

المتطلب المسبق الوحيد للمستودع: قاعدة `teacher_platform_e2e` مُنشأة ومهاجرة (انظر أدناه). السكربت يشغّل `npm ci` للواجهة ولمجلد `e2e/`.

### سطر واحد

يشغّل API + Web، يعمل seed، ثم يغطي Builder القديم، مسار English Spark الجديد، Progressive Challenge، اللاعب الفردي، restart recovery، ثم Live.

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

## التغطية

- `part-d-builder.spec.mjs`: يحافظ على مسار Quiz Builder / Publish / Session التقليدي كتراجع تقني مهم، حتى مع وجود تجربة English Spark الأبسط فوقه.
- `part-f-english-spark-golden-path.spec.mjs`: ينشئ معلمة وWorkspace وبنك أسئلة معزولين، ثم يثبت المسار الجديد كاملًا من تسجيل الدخول → إنشاء نشاط → اختيار أسئلة من البنك → تجهيز ومشاركة → QR/Join Code → معاينة كطالب → بدء Progressive Challenge والوصول لأول سؤال. هذا الاختبار لا يعتمد على بيانات الـseed القديمة.
- `part-e-progressive.spec.mjs`: يغطي Progressive Challenge وسلوك المستويات والتقدم والاستعادة والحالات النهائية.
- `part-a.spec.mjs`: يثبت كوكي `tp-guest` (HttpOnly + Path=/ + Lax + غير قابل للقراءة من JS)، إجابة + تنقل بين الأسئلة، ثم F5 يستعيد الجلسة عبر `GET /me` عند السؤال الثاني دون شاشة انضمام.
- `part-b.spec.mjs`: يثبت الصمود عبر إعادة تشغيل الـAPI، ثم يغطي مسار النجاح (10/10، PDF، استبانة من ستة أسئلة، رابط ولي الأمر، استعادة النتيجة بعد F5، تقرير المعلم وتصدير CSV) ومسار الرسوب المعزول (0/10 ولا شهادة).
- `part-c-live.spec.mjs`: يشغّل Host ولاعبًا في browser contexts منفصلة، ويفتح سؤالين ويغلقهما وينهي الجلسة؛ يثبت أن اللاعب لا يرى صحة الإجابة قبل الإغلاق، وأن الترتيب والنتيجة وF5 تعمل من الحالة الخادمية.
- بعد تشغيل seed، يمكن إعادة Part C وحده مع خوادم مؤقتة وتنظيف آمن عبر `.\run-e2e.ps1 -Stage live`.

## التنظيف

```powershell
Remove-Item -Recurse -Force .\state.json, .\storage.json, .\test-results, .\playwright-report
Remove-Item -Recurse -Force ..\backend\src\TeacherPlatform.Api\.dev-mail
```
