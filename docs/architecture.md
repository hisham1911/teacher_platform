# معمارية النظام

## نظرة عامة

المنصة مبنية كـ Modular Monolith واضح قابل للتقسيم لاحقًا:

```text
Browser
  │ HTTPS
  ▼
React SPA (Vite → dist → Vercel CDN)
  │ HTTPS REST (/api/v1) — لاحقًا SignalR
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
- SignalR سيُضاف للمسابقات المباشرة (Phase 6) بنفس الـ API.

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
- **Quiz Limit** (`IQuizLimitService`) يفرض حدًا أقصى للاختبارات النشطة لكل Tenant
  (افتراضي 50، قابل للإعداد عبر `Quiz:MaxActivePerTenant`).

## Phase 4 — الجلسات ومشغل الطالب والتصحيح الخادمي

- **QuizSession** يربط اختبارًا منشورًا بجمهور: `JoinCode` عام (8 أحرف)، `Mode`
  (SelfPaced فقط في Phase 4 — Live مرفوض بـ`LiveModeNotAvailable`)، `Status`
  (Scheduled/Active/Finished/Cancelled)، و`QuizVersionId` يُثبَّت عند التفعيل.
- **SessionParticipant** يمثل طالبًا بلا حساب: رمز ضيف 256-bit يُخزن **هاش SHA-256
  فقط** ويُقارن بمقارنة ثابتة الزمن، ويُنقل بكوكي HttpOnly (`__Host-tp-guest`) —
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
