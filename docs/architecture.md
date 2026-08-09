# معمارية النظام

## نظرة عامة

المنصة مبنية كـ Modular Monolith واضح قابل للتقسيم لاحقًا:

```text
Browser
  │ HTTPS
  ▼
React SPA (Vite → dist → Vercel CDN)
  │ HTTPS REST (/api/v1) + SignalR (/hubs/quiz)
  ▼
ASP.NET Core Web API (Kestrel خلف Nginx)
  │
  ├── PostgreSQL (EF Core 10 + Npgsql) — مصدر الحقيقة الوحيد
  ├── Object Storage متوافق مع S3 (لاحقًا)
  └── SMTP / Email Provider (لاحقًا)
```

## المكوّنات

- **Frontend (`apps/web`)**: React 19 + Vite + TypeScript strict. يُبنى كملفات Static وتُنشر على Vercel. يتواصل مع الخادم عبر `src/data/api-client/` فقط — لا استدعاءات `fetch` خارج هذه الحدود، ولا أي Database/Supabase SDK.
- **Backend (`backend`)**: ASP.NET Core Web API على .NET 10 LTS بنظام مشاريع:
  - `Domain`: كيانات المجال الصافي بلا اعتماديات تقنية.
  - **Application:** Use Cases والـAbstractions (`IClock`، مستقبلًا `ICurrentUser`, `ITenantContext`, `IObjectStorage`, `IEmailSender`). بدون MediatR/AutoMapper.
  - **Infrastructure:** `AppDbContext` وإعدادات EF Core والـMigrations وتنفيذات PostgreSQL.
  - **Api:** Controllers، إعداد OpenAPI، ProblemDetails، Health Checks، CORS، Forwarded Headers، Middleware.
- **قاعدة البيانات:** PostgreSQL 15+ (محلية في التطوير، Managed أو VPS في الإنتاج).

## عقود ثابتة

- Base path: `/api/v1`.
- الأخطاء بصيغة RFC 7807 `ProblemDetails`.
- نقاط الصحة: `/health/live` (لا تفحص شيئًا) و `/health/ready` (تفحص قاعدة البيانات).
- كل Request يحصل `X-Request-Id` (Correlatie) في الردود.

## ما لا يُستخدم (قرار معماري)

- لا Next.js / Server Components / Vercel Functions في الواجهة.
- لا Supabase SDK ولا أي اتصال قاعدة بيانات من المتصفح.
- لا MediatR ولا Generic Repository ولا Redis ولا Microservices في MVP.
- لا `Database.Migrate()` تلقائيًا في Production — Migrations عبر CI/CD أو يدويًا بعد Backup.

## تدفق الطلب

1. المتصفح يحمّل SPA من CDN.
2. الواجهة تستدعي `apiClient` → `VITE_API_BASE_URL` → Nginx → Kestrel.
3. الـ API يتحقق (لاحقًا من JWT والـ Tenant Membership) ثم ينفذ المنطق عبر Application services.
4. EF Core يقرأ/يكتب PostgreSQL؛ النتيجة تُعاد كـ DTO وليس كـ Entity.

## استضافة مستقبلية

- الواجهة: Vercel (Static SPA مع rewrite إلى index.html).
- الـ API: Linux VPS + Nginx + systemd، مع `ForwardedHeaders` مهيأة مسبقًا.
- SignalR للمسابقات المباشرة يعمل من نفس Kestrel عبر `/hubs/quiz`؛ النشر الحالي single-node ولا يحتاج Redis backplane.

## Phase 2 — Media و Object Storage

- كل الوسائط تُخزن كـObjects خارج PostgreSQL (لا Binary).
- تجريد `IObjectStorage` مع تنفيذ Local (`Provider=Local`) للتطوير/الاختبارات:
  يحفظ تحت `.media-storage/` ولا يكشف المسار؛ كل القراءة تمر عبر
  `GET /api/v1/tenants/{tenantId}/media/{id}/content` بعد تحقق العضوية والمستأجر.
- تنفيذ S3-compatible موجودكعلاج للإنتاج، لكن لا يُفعّل إلا بعد اختيار SDK،
  وبيانات الاعتماد في Secret دائمًا — لا في المستودع.
- Question/QuestionVersion: نموذج تعدد نسخ مع إصدارات Immutable، وRowVersion (xmin)
  للحماية من التعديل المتزامن: أي `<baseVersion>` قديمة تعيد 409.

## Phase 3 — Quiz Builder والنشر

- **Quiz** كهوية (Identity) تحمل الحالة العامة والمؤشرات إلى النسخة المسودة الحالية
  (`CurrentDraftVersionId`) والنسخة المنشورة الحالية (`CurrentPublishedVersionId`)؛
  المحتوى الفعلي يعيش في **QuizVersion** (Immutable).
- **QuizVersionItem** يثبّت `QuestionVersionId` داخل النسخة — لا يتغير بعد إنشاء النسخة،
  مما يضمن أن الطالب يرى نفس الأسئلة التي رآها المعلم عند النشر.
- **النشر (Publish)** يتطلب `IsValid` على النسخة المسودة: كل سؤال يجب أن يكون `Active`
  وله `CurrentVersionId` صالح، وكل `QuestionVersionId` يجب أن يكون موجودًا في نفس الـTenant.
- **Optimistic Concurrency** عبر `xmin` (RowVersion) على `Quiz` و`QuizVersion` — أي
  `BaseVersion` قديمة تعيد `409 Conflict`.
- **Public Code** (`PublicCode`) يُولّد تلقائيًا عند الإنشاء (GUID-only، 32 حرفًا)
  ويُستخدم للوصول العام للاختبار المنشور عبر `GET /api/v1/public/quizzes/{publicCode}`.
- **Quiz Limits** (`IQuizLimitService`) تفرض حدودًا مستأجر-scoped عبر قسم `QuizLimits`:
  `MaxQuizzesPerTenant` (100)، و`MaxQuestionsPerQuiz` (200)، و`MaxPublishedQuizzesPerTenant` (50).

## Phase 4 — الجلسات ومشغل الطالب والتصحيح الخادمي

- **QuizSession** يربط اختبارًا منشورًا بجمهور: `JoinCode` عام (8 أحرف)، `Mode`
  (`SelfPaced` أو `Live`)، `Status`
  (Scheduled/Active/Finished/Cancelled)، و`QuizVersionId` يُثبَّت عند إنشاء الجلسة.
- **SessionParticipant** يمثل طالبًا بلا حساب: رمز ضيف 256-bit يُخزن **هاش SHA-256
  فقط** ويُقارن بمقارنة ثابتة الزمن، ويُنقل بكوكي HttpOnly يعتمد اسمه على
  `Auth:UseSecureCookie` (`__Host-tp-guest` في الوضع الآمن، و`tp-guest` عند `false`) —
  التفاصيل في ADR 007. `ShuffleSeed` لكل مشارك يقود خلطًا حتميًا للأسئلة
  (`SeededShuffler`) فيرى الطالب نفس الترتيب عبر الجلسات والاستئناف.
- **Attempt / AttemptAnswer**: محاولة واحدة نشطة لكل مشارك؛ الإجابات Immutable
  بعد القبول — إعادة نفس الإجابة Idempotent (200)، وإجابة مختلفة = 409.
  `AnswerJson` مخزن `jsonb` لذلك تتم المقارنة **دلاليًا** لا نصيًا (ADR 008).
- **التصحيح خادمي بالكامل** عبر `AnswerScorer` (Domain، دالة نقية بلا استثناءات)
  لخمسة أنواع أسئلة؛ DTO اللاعب لا يكشف الإجابات الصحيحة قبل الإنهاء.
- **سلطة الوقت خادمية**: `serverNow` في كل استجابة، و`DeadlineAt` يُفرض بأسلوب
  settle-on-request — أي طلب بعد انقضاء الوقت يُنهي المحاولة `TimedOut` ثم يُرد.
- **Rate Limiting** على كل نقاط اللاعب `[AllowAnonymous]` لإبطاء تخمين JoinCode.

## Phase 4.1 — تحصين المتصفح والتحقق من حمولات الإجابة

- استعادة اللاعب بعد F5 من الخادم فقط عبر `GET /api/v1/player/sessions/{joinCode}/me`؛ لا يعتمد Player على `localStorage` لاستعادة الاسم أو الجلسة.
- `InvalidAnswerPayload` يُرفض بـ`400` قبل حفظ الإجابة أو حساب الدرجة أو الانتقال للسؤال التالي.
- يوجد Playwright E2E harness داخل `e2e/`، مع Cookie ضيف HttpOnly وإعدادات بيئة E2E قابلة للتشغيل.

## Phase 5 — التقارير والاستبانة والشهادات

- **التقارير** مشتقة عند الطلب من `Attempts` و`AttemptAnswers`؛ لا توجد أرقام تجريبية أو Cache إحصائي. الاستعلامات خاضعة لمرشح المستأجر، وتصدير CSV يمر بسياسة Rate Limit مستقلة ويعالج Spreadsheet Formula Injection.
- **الاستبانة** واحدة لكل Quiz. تبقى قابلة للتعديل في `Draft` مع `xmin`، ثم تصبح Immutable بعد `Published`. يستطيع صاحب المحاولة المكتملة إرسال رد واحد فقط من الأنواع `Rating` و`SingleChoice` و`ShortText`.
- **الشهادة** تُصدر Idempotently لمحاولة ناجحة فقط. يسجل Transaction واحد Snapshot بيانات الشهادة ورسالة `CertificateGenerationRequested`؛ ثم يعالج `OutboxWorker` الرسالة خارج الطلب، يولد PDF عربيًا عبر QuestPDF، ويخزنه من خلال `IObjectStorage`.
- **Outbox** داخل نفس PostgreSQL: claim ذري، قفل مؤقت، عداد محاولات، Backoff، وحالة فشل نهائية يمكن للمعلم إعادة تشغيلها. مفتاح الملف حتمي `certificates/{tenantId}/{certificateId}.pdf`، لذلك إعادة المعالجة لا تنشئ نسخة ثانية.
- **الروابط العامة** لا تستخدم معرّفات قاعدة البيانات كأسرار. هاش رمز الشهادة فقط هو المفتاح القابل للبحث، بينما تُحمى نسخته القابلة لإعادة العرض عبر ASP.NET Core Data Protection. رابط ولي الأمر له رمز مستقل مخزن كهاش وينتهي افتراضيًا بعد 7 أيام، وDTO العام محدود بملخص النتيجة ومجالات المراجعة ورابط الشهادة الجاهزة.
- خيارات التشغيل تحت `Certificates`. الإنتاج يفشل عند غياب اختيار `QuestPdfLicense`، ويتطلب مفاتيح Data Protection دائمة وخطًا متوافقًا (`DejaVu Sans` افتراضيًا على Linux). التفاصيل في ADR 009.

## Phase 6 — المسابقات المباشرة

- `LiveSessionStates` في PostgreSQL هو مصدر الحقيقة للحالة (`Lobby`, `QuestionOpen`, `QuestionClosed`, `Finished`) وللسؤال الحالي والموعد و`Revision`. SignalR ينقل snapshots ولا يحتفظ بحالة مستقلة.
- أوامر المعلم والإجابات تمر عبر REST. Hub `/hubs/quiz` للإشعارات فقط ولا يعرض methods لاختيار group أو إرسال إجابة.
- المعلم يحصل على JWT Live قصير العمر بعد فحص Owner/Teacher، واللاعب بعد التحقق من Guest Cookie وملكية المشارك. Hub يعيد التحقق من العضوية أو المشارك ثم يضيف الاتصال إلى group ثابت يبنيه الخادم.
- أثناء `QuestionOpen` لا تحتوي DTOs على صحة الخيارات، ونتيجة `submitAnswer` تحجب `isCorrect` و`scoreAwarded`. بعد الإغلاق تُحسب لوحة الترتيب من الإجابات المخزنة للأسئلة المغلقة فقط؛ الإنهاء يثبت النتائج النهائية خادميًا لكل المحاولات الجارية.
- Worker يغلق السؤال بعد `QuestionClosesAt + GraceWindowSeconds`. الواجهة تستخدم SignalR مع إعادة اتصال تلقائية وpolling fallback؛ لا يوجد Redis في نطاق النشر single-node الحالي. التفاصيل في ADR 010.
