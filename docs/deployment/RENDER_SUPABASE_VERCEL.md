# نشر Teacher Platform على Render وSupabase وVercel

هذا الدليل خاص بفرع `deploy/render-supabase-vercel`. البنية المستهدفة هي:

- واجهة React/Vite ثابتة على Vercel.
- ASP.NET Core 10 API على Render كخدمة Docker طويلة العمر.
- PostgreSQL وStorage في Supabase كبنية تحتية فقط.
- SMTP خارجي للبريد.

لا يستخدم النظام Supabase Auth أو Supabase JS أو Supabase Realtime. المصادقة وSignalR ومنطق العمل تبقى داخل تطبيق .NET.

## 1. القرارات المعتمدة

| الجزء | القرار |
| --- | --- |
| Render | Docker Web Service على خطة `starter` في `frankfurt`، مع Persistent Disk وPre-deploy migration bundle. |
| PostgreSQL | Supavisor Session Pooler على المنفذ `5432` ما لم يتوفر اتصال Direct عبر IPv6 أو Supabase IPv4 add-on. |
| Storage | Supabase Storage عبر S3 endpoint المباشر، بمفاتيح S3 server-side و`ForcePathStyle=true`. |
| Migrations | `efbundle` يُبنى داخل صورة Docker ويعمل مرة واحدة في Render Pre-deploy. لا يوجد `Database.Migrate()` في startup. |
| Data Protection | مفاتيح دائمة تحت `/var/data/teacher-platform/data-protection` على Render Persistent Disk. |
| Cookies | `Secure=true`. مع نطاقات `vercel.app` و`onrender.com` استخدم `SameSite=None`; مع `app.example.com` و`api.example.com` يمكن استخدام `Lax` بعد اختبار المتصفح. |
| Vercel | Root Directory هو `apps/web`، Node.js `24.x`، Build `npm run build`، Output `dist`. |

اختيار `frankfurt` مناسب كبداية لقربه النسبي من مستخدمي المنطقة. لا يمكن تغيير Region لخدمة Render بعد إنشائها؛ غيّر `render.yaml` قبل أول Blueprint إذا تقرر موقع آخر، واختر Supabase region قريبًا منه.

## 2. الملفات المستخدمة

- `backend/Dockerfile`: بناء متعدد المراحل لـ.NET 10، تطبيق API وmigration bundle فقط.
- `backend/.dockerignore`: يمنع إرسال build/test/local/secret artifacts إلى Docker context.
- `render.yaml`: Blueprint لخدمة API المدفوعة المستقرة.
- `ops/deploy/render.env.example`: قائمة إعدادات Render دون أسرار.
- `ops/deploy/vercel.env.example`: إعداد Vercel العام الوحيد.
- `apps/web/vercel.json`: SPA rewrites وsecurity headers الحالية.

## 3. إنشاء مشروع Supabase

1. أنشئ Project في region قريب من Render region المختار.
2. لا تفعّل Supabase Auth لهذا التطبيق.
3. من صفحة **Connect** احتفظ بقيم اتصال PostgreSQL.
4. من **Storage** أنشئ bucket خاصًا للوسائط. لا تجعل ملفات الأسئلة عامة.
5. فعّل S3 protocol من إعدادات Storage، ثم أنشئ S3 access key وsecret مخصصين للخادم.

مفاتيح Supabase S3 تتجاوز RLS ولها صلاحية server-side واسعة على Storage؛ خزّنها في Render فقط، ولا تضعها في Vercel أو Git.

## 4. اتصال PostgreSQL

Render يعرض نطاقات خروج IPv4، بينما Supabase Direct endpoint يكون IPv6 افتراضيًا ما لم تُشترَ IPv4 add-on. لذلك الإعداد الافتراضي لهذا الفرع هو Supavisor Session Pooler:

```text
Host=aws-REGION.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.PROJECT_REF;Password=SET_IN_RENDER_SECRET_STORE;SSL Mode=Require
```

انسخ host وusername وregion الفعلية من **Supabase Dashboard → Connect → Session pooler**. لا تستخدم Transaction Pooler على `6543`: هو مخصص للعملاء المؤقتين ولا يدعم prepared statements، بينما API هو backend دائم يستخدم EF Core/Npgsql.

إذا أضيف Supabase IPv4 add-on أو ثبت أن Render يصل إلى Direct IPv6 في البيئة الفعلية، يمكن استخدام Direct endpoint على `5432`. Direct هو الخيار الأفضل للمهاجرات والنسخ الاحتياطي عندما يكون قابلًا للوصول.

ضع الاتصال كاملًا في `ConnectionStrings__DefaultConnection` داخل Render Secret Store. لا تستخدم Supabase SDK ولا Data API.

## 5. إعداد Supabase Storage S3

ضع القيم التالية من صفحة Supabase S3 configuration نفسها:

```text
Storage__Provider=S3
Storage__Endpoint=https://PROJECT_REF.storage.supabase.co/storage/v1/s3
Storage__Bucket=PRIVATE_BUCKET_NAME
Storage__AccessKey=SET_IN_RENDER_SECRET_STORE
Storage__SecretKey=SET_IN_RENDER_SECRET_STORE
Storage__Region=PROJECT_REGION_FROM_SUPABASE_S3_SETTINGS
Storage__ForcePathStyle=true
```

التنفيذ الحالي يستخدم `PutObject`, `GetObject`, `HeadObject`, و`DeleteObject`، وكلها مدعومة في Supabase S3 compatibility. لا يحتاج التطبيق تعديلًا ولا يجعل الوسائط عامة. Supabase Storage لا يدعم S3 object versioning؛ حذف object نهائي، لذلك اختبر الحذف والنسخ الاحتياطي وفق سياسة المنتج.

بعد النشر اختبر:

1. رفع صورة.
2. رفع MP3 وM4A وWAV PCM ضمن الحدود الحالية.
3. فتح الوسيط من Teacher UI ومن Student Player.
4. إعادة تشغيل Render ثم فتح الوسيط نفسه للتأكد أنه لم يعتمد على filesystem محلي.

## 6. Docker strategy

`backend/Dockerfile` يستخدم:

- `mcr.microsoft.com/dotnet/sdk:10.0` للبناء.
- `mcr.microsoft.com/dotnet/aspnet:10.0` للتشغيل.
- `dotnet publish --configuration Release` للـAPI.
- `dotnet-ef` `10.0.10` لبناء `efbundle` متوافق مع إصدار EF الحالي.
- `fonts-dejavu-core` و`fontconfig` لضمان وجود `DejaVu Sans` لشهادات PDF العربية.

الصورة النهائية لا تحتوي source أو tests أو SDK. يبدأ الـAPI بالأمر الموجود في `CMD` ويستمع على:

```text
http://0.0.0.0:${PORT:-10000}
```

Render يزود `PORT` تلقائيًا. لا تضف `ASPNETCORE_URLS` ثابتًا ولا تستخدم `127.0.0.1:5000` في Production.

فحص محلي بعد توفر Docker:

```powershell
docker build --tag teacher-platform-api:deploy --file backend/Dockerfile backend
docker image inspect teacher-platform-api:deploy
```

لا تمرر أسرارًا كـDocker build args. أسرار Render تكون runtime environment فقط.

## 7. EF Core migrations

الصورة تحتوي `/app/efbundle`. يحدد `render.yaml`:

```yaml
preDeployCommand: /app/efbundle
```

Render يشغّل Pre-deploy على instance منفصل قبل تشغيل الإصدار الجديد، ولذلك لا تطبق عدة API instances migration بالتزامن. `efbundle` idempotent: يطبق migrations غير الموجودة فقط باستخدام `ConnectionStrings__DefaultConnection`.

قبل كل نشر يحتوي schema change:

1. خذ backup قابلًا للتحقق من Supabase بالطريقة المتاحة في خطة المشروع.
2. راجع migrations الموجودة في commit.
3. شغّل deploy؛ فشل bundle يوقف النشر قبل تبديل الخدمة.
4. تحقق من جدول `__EFMigrationsHistory` ومن `/health/ready`.

لا تضف `Database.Migrate()` أو `EnsureCreated()` إلى `Program.cs`، ولا تشغّل Down migrations تلقائيًا.

Render Pre-deploy غير متاح لخدمة Web مجانية. إن استُخدمت Free service كتجربة قصيرة، يجب تطبيق نفس bundle من بيئة تشغيل موثوقة قبل تشغيل الإصدار. هذا ليس مسار Pilot مستقرًا.

## 8. Render Blueprint

1. راجع `render.yaml` قبل إنشاء Blueprint، خصوصًا `region`, `plan`, واسم الخدمة.
2. اربط المستودع وحدد فرع `deploy/render-supabase-vercel`.
3. أنشئ Blueprint من `render.yaml`.
4. املأ كل متغير عليه `sync: false` في شاشة Render. لا تضع قيمه في الملف.
5. أبقِ `autoDeployTrigger: off` حتى تكتمل أول مراجعة ونشر يدوي. يمكن تغييره لاحقًا إلى `checksPass` بعد اعتماد CI.
6. Health Check يجب أن يبقى `/health/ready`؛ هذا المسار يفحص PostgreSQL.

الخطة `starter` مقصودة لأن:

- Pre-deploy command مدعوم على الخدمات المدفوعة.
- Persistent Disk غير متاح على Free.
- Free يتوقف بعد الخمول ويفقد filesystem المحلي.
- Free يمنع outbound SMTP على المنافذ `25`, `465`, و`587`.

`render.yaml` يثبت instance واحدة لأن Persistent Disk لا يدعم horizontal scaling. إضافة disk تمنع zero-downtime deploys وتسبب توقفًا قصيرًا أثناء الاستبدال. إذا أصبح التوسع الأفقي مطلوبًا، يجب أولًا نقل Data Protection keys إلى مخزن مشترك معتمد؛ لا تُضف instances متعددة مع مفاتيح منفصلة.

## 9. Environment variables في Render

القائمة الكاملة موجودة في `ops/deploy/render.env.example`. الحقول الأساسية:

| المتغير | الغرض | Secret؟ |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | يجب أن يكون `Production`. | لا |
| `ConnectionStrings__DefaultConnection` | Npgsql connection إلى Supabase. | نعم |
| `Jwt__Issuer` | API origin الفعلي. | لا |
| `Jwt__Audience` | Web origin الفعلي. | لا |
| `Jwt__SigningKey` | مفتاح توقيع لا يقل عن 32 حرفًا؛ Blueprint يولده عند الإنشاء. | نعم |
| `Jwt__AccessTokenMinutes`, `Jwt__ClockSkewMinutes` | عمر access token وهامش الوقت. | لا |
| `Auth__RefreshTokenDays` | عمر refresh token. | لا |
| `Auth__UseSecureCookie` | `true` في Production. | لا |
| `Auth__CookieSameSite` | `None` للنطاقات الافتراضية المختلفة؛ `Lax` للنطاقات الفرعية المشتركة بعد الاختبار. | لا |
| `Auth__TrustedOrigins__0` | Vercel origin واحد وصريح دون slash نهائي. | لا |
| `Auth__WebBaseUrl` | Vercel origin لبناء روابط البريد والشهادات والنتائج. | لا |
| `Cors__AllowedOrigins__0` | نفس Vercel production origin. | لا |
| `IdentityLockout__*` | حدود قفل محاولات الدخول. | لا |
| `DataProtection__ApplicationName` | يبقى `TeacherPlatform`. | لا |
| `DataProtection__KeysDirectory` | مسار داخل Persistent Disk. | لا |
| `RateLimiting__*` | حدود المعدل الحالية. | لا |
| `QuizLimits__*` | fallback limits الحالية. | لا |
| `Session__*` | grace, guest token, join code, live timer/monitor. | لا |
| `Mail__Provider` | يجب أن يكون `Smtp`. | لا |
| `Mail__Host`, `Mail__Port` | endpoint الخاص بمزود SMTP. | لا |
| `Mail__Username`, `Mail__Password` | بيانات SMTP. | نعم |
| `Mail__Security` | `StartTls`. | لا |
| `Mail__FromAddress`, `Mail__FromName` | sender موثق لدى المزود. | العنوان لا؛ الاعتماد عند المزود خارجي |
| `Storage__Provider` | يجب أن يكون `S3`. | لا |
| `Storage__Endpoint`, `Storage__Bucket`, `Storage__Region` | قيم Supabase S3. | لا |
| `Storage__AccessKey`, `Storage__SecretKey` | مفاتيح S3 server-side. | نعم |
| `Storage__ForcePathStyle` | `true` حسب Supabase S3 client example. | لا |
| `Storage__DownloadUrlExpiryMinutes`, `Storage__ImageMaxBytes`, `Storage__AudioMaxBytes` | الحدود الحالية. | لا |
| `Certificates__QuestPdfLicense` | `Community` أو `Professional` أو `Enterprise` بعد قرار الأهلية. | لا، لكنه قرار إلزامي |
| `Certificates__LinuxFontFamily` | `DejaVu Sans`. | لا |
| بقية `Certificates__*` | polling, retry, lock, parent-share periods. | لا |
| `SeedRoles` | ينشئ أسماء الأدوار الناقصة فقط، ولا ينشئ PlatformAdmin user. | لا |

لا تضف `PORT`: Render يزوده. لا تضف أي Secret إلى `VITE_*`.

## 10. Data Protection

`Program.cs` يخزن المفاتيح في filesystem ويمنع وضعها تحت release directory في Production. المسار المعتمد:

```text
/var/data/teacher-platform/data-protection
```

يُركب disk عند `/var/data/teacher-platform`. بعد أول تشغيل:

1. تأكد من إنشاء key files داخل المسار.
2. سجل دخولًا وأنشئ Student guest session.
3. أعد نشر/تشغيل الخدمة.
4. تأكد أن flows المعتمدة على tokens/cookies ما زالت تعمل.

Free smoke test يمكن أن يبدأ بمسار مؤقت فقط، لكن المفاتيح تضيع عند spin-down/restart/redeploy. هذا قد يبطل tokens المحمية ولا يصلح Pilot مستقرًا. لا تُلغ persistence ولا تخفض أمان cookies لتجاوز هذا القيد.

## 11. SMTP

Production validation يرفض `Mail__Provider=File` ويرفض SMTP بلا TLS. يلزم مزود SMTP خارجي مع sender موثق وإعدادات:

```text
Mail__Provider=Smtp
Mail__Host=...
Mail__Port=...
Mail__Username=...
Mail__Password=...
Mail__Security=StartTls
Mail__FromAddress=...
Mail__FromName=Teacher Platform
```

Render Free يمنع outbound ports `25`, `465`, و`587`. Blueprint يستخدم `starter`. إذا اختير Free smoke test، يلزم مزود يقدم منفذًا آخر مسموحًا مثل منفذ يحدده المزود؛ لا تفترض رقمًا دون الرجوع إليه.

اختبر Registration confirmation وForgot Password بعد النشر، ولا تسجل كلمة المرور أو محتوى رابط token في logs.

## 12. QuestPDF والشهادات

ضع `Certificates__QuestPdfLicense` بعد مراجعة أهلية المشروع:

- `Community`
- `Professional`
- `Enterprise`

Production لا يبدأ إذا كانت القيمة فارغة. Docker runtime يثبت `fonts-dejavu-core` ويضبط `Certificates__LinuxFontFamily=DejaVu Sans`.

بعد النشر اختبر طالبًا ناجحًا حتى يصل OutboxWorker إلى الحالة `Ready`، ثم افتح PDF وتحقق من العربية والاسم والاختبار والدرجة والتاريخ ورقم الشهادة. اختبر Retry لحالة فشل حقيقية فقط.

## 13. Hosted Services وSignalR

`LiveSessionMonitor` و`OutboxWorker` يبدآن مع عملية API نفسها. لا تنشئ Render Background Worker منفصلًا في هذه المرحلة.

Render Web Services تدعم WebSockets. العميل يتصل إلى `/hubs/quiz` ويستخدم automatic reconnect الحالي. بعد النشر اختبر Host وStudent في متصفحين:

1. الطالب ينضم عبر `/play/:joinCode`.
2. Host يرى participant.
3. Start/Open/Answer/Close/Next/Finish.
4. قطع الشبكة مؤقتًا ثم reconnect.
5. Refresh للـHost والطالب في الحالات التي يدعمها المنتج.

استخدم `wss://` عبر نطاق Render العام؛ TLS ينتهي عند Render ثم يُمرر `X-Forwarded-Proto` الذي يعالجه التطبيق.

## 14. Vercel

أنشئ Vercel Project من نفس المستودع بهذه القيم:

| الإعداد | القيمة |
| --- | --- |
| Production Branch | `deploy/render-supabase-vercel` |
| Root Directory | `apps/web` |
| Framework | Vite |
| Node.js | `24.x` |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |

أضف:

```text
VITE_API_BASE_URL=https://API_NAME.onrender.com
```

القيمة عامة وليست Secret. أي تغيير عليها يحتاج deployment جديد لأن Vite يثبتها وقت build.

`apps/web/vercel.json` يعيد SPA routes إلى `index.html` مع استثناء الأصول الثابتة، لذلك refresh يجب أن يعمل على `/dashboard/*`, `/play/*`, `/q/*`, `/result/*`, و`/certificate/*`. كما يسمح CSP باتصالات `https:` و`wss:` اللازمة للـAPI وSignalR.

## 15. CORS وCookies والنطاقات

### أول نشر على النطاقات الافتراضية

إذا كانت الواجهة `https://APP_NAME.vercel.app` والـAPI `https://API_NAME.onrender.com` فهما cross-site:

```text
Auth__UseSecureCookie=true
Auth__CookieSameSite=None
Auth__TrustedOrigins__0=https://APP_NAME.vercel.app
Auth__WebBaseUrl=https://APP_NAME.vercel.app
Cors__AllowedOrigins__0=https://APP_NAME.vercel.app
```

العميل يستخدم `credentials: include`، والـAPI يسمح credentials لorigin صريح. بعض سياسات المتصفحات قد تمنع third-party cookies؛ لذلك اختبر Login/Refresh وStudent resume في Chrome وSafari قبل Pilot.

### النطاقات المخصصة

مع `https://app.example.com` و`https://api.example.com` يصبحان same-site مع بقائهما cross-origin. اضبط origins إلى العناوين الفعلية، واستخدم `SameSite=Lax` بعد اختبار المتصفح. هذا هو المسار المفضل لتجنب الاعتماد طويل الأجل على third-party cookies.

ممنوع wildcard في CORS مع credentials، والتطبيق يرفضه عند startup. Vercel preview URLs متغيرة؛ لا تضف wildcard. استخدم preview origin ثابتًا أو أضف origin محددًا يدويًا لبيئة Preview منفصلة.

## 16. ترتيب أول نشر

1. أنشئ Supabase Project وprivate Storage bucket وS3 credentials.
2. قرر QuestPDF license ومزود SMTP.
3. راجع Render region والخطة قبل إنشاء Blueprint.
4. أنشئ Blueprint واملأ `sync: false` values.
5. شغّل deploy يدويًا؛ راقب نجاح `efbundle` قبل startup.
6. تحقق من `/health/live` و`/health/ready`.
7. أنشئ Vercel Project وأضف `VITE_API_BASE_URL` ثم انشر.
8. عدّل Render origins وWebBaseUrl إلى Vercel production URL الفعلي ثم أعد deploy.
9. نفذ smoke test أدناه.

## 17. Smoke test بعد النشر

1. `GET https://API_NAME.onrender.com/health/live` يعيد نجاحًا.
2. `GET https://API_NAME.onrender.com/health/ready` يعيد نجاحًا ويتحقق من Supabase.
3. Register → email confirmation → login → refresh بعد إعادة تحميل الصفحة.
4. إنشاء Workspace واختبار، رفع صورة وصوت، preview وpublish.
5. إنشاء Self-paced session، join من متصفح مستقل، answer، F5 resume، finish/result.
6. طالب ناجح: survey، certificate processing، PDF، parent share.
7. Live competition كاملة مع WebSocket reconnect.
8. فتح Reports وCSV والشهادات.
9. مراجعة Render logs: لا secrets أو tokens أو storage paths.
10. مراجعة Browser Console/Network: لا CORS errors أو 500 غير متوقع.

## 18. Persistence وrestart checks

بعد نجاح smoke test:

1. سجل fingerprint/تاريخ ملف Data Protection key دون نسخ محتواه.
2. أعد تشغيل Render service.
3. تأكد أن key files باقية.
4. تأكد أن PostgreSQL data والوسائط والشهادة باقية.
5. تأكد أن Hosted Services عادت للعمل ولم توجد Outbox messages عالقة.

## 19. Rollback

1. أوقف rollout إذا فشل `efbundle` أو `/health/ready`؛ لا تتجاوز readiness.
2. استخدم Render rollback إلى آخر image/commit معروف، وVercel rollback إلى آخر deployment معروف.
3. لا تشغّل migration Down تلقائيًا.
4. يجب أن تكون migrations backward-compatible مع الإصدار السابق خلال نافذة rollback.
5. إذا كان rollback يتطلب قاعدة أقدم، استعد backup متحققًا إلى قاعدة/مشروع منفصل، راجع البيانات، ثم غيّر connection string. لا تكتب فوق Production database عميانيًا.
6. لأن Supabase S3 versioning غير مدعوم، لا تعتمد على rollback لاستعادة object محذوف.

## 20. سياسة الأسرار

لا يُسمح بوجود القيم التالية في Git أو Vercel frontend variables:

- Database password أو connection string حقيقية.
- JWT signing key.
- Supabase S3 access/secret keys.
- SMTP credentials.
- Render/Vercel tokens.

Git يتتبع ملفات `*.env.example` فقط داخل `ops/deploy`. خزّن القيم الفعلية في Render/Vercel/Supabase dashboards أو secret manager معتمد.

## 21. المراجع الرسمية

- Render Docker: https://render.com/docs/docker
- Render Web Services وPORT: https://render.com/docs/web-services
- Render Health Checks: https://render.com/docs/health-checks
- Render Pre-deploy: https://render.com/docs/deploys
- Render Persistent Disks: https://render.com/docs/disks
- Render Free limitations وSMTP: https://render.com/docs/free
- Render WebSockets: https://render.com/docs/websocket
- Render Blueprint spec: https://render.com/docs/blueprint-spec
- Supabase PostgreSQL connections: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase S3 authentication: https://supabase.com/docs/guides/storage/s3/authentication
- Supabase S3 compatibility: https://supabase.com/docs/guides/storage/s3/compatibility
- Vercel monorepos: https://vercel.com/docs/monorepos
- Vercel Vite: https://vercel.com/docs/frameworks/frontend/vite
- Vercel rewrites: https://vercel.com/docs/routing/rewrites
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Node.js versions: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
