# خطة تنفيذ منصة المعلم والاختبارات SaaS باستخدام React وASP.NET Core

**الإصدار:** 2.1 — React + Vite للواجهة و.NET للباك إند  
**التاريخ:** 31 يوليو 2026  
**حالة الوثيقة:** معتمدة كبداية تنفيذ  
**الجمهور:** أي AI Agent أو مطور سيشارك في بناء المشروع  
**لغة لوحة المعلم الأساسية:** العربية RTL  
**لغة تجربة الطالب:** العربية أو الإنجليزية حسب إعداد الاختبار  

---

## 1. تعليمات إلزامية للإيجنت قبل بدء العمل

اقرأ هذه الوثيقة كاملة قبل تعديل أي ملف. لا تنفذ المشروع كله دفعة واحدة.

1. افحص المستودع الحالي والتقنيات والإصدارات والملفات الموجودة أولًا.
2. شغّل المشروع والاختبارات والـBuild قبل أي تعديل وسجل حالة البداية.
3. حافظ على أي عمل موجود للمستخدم، ولا تحذف أو تعيد كتابة أجزاء غير مرتبطة.
4. نفّذ مرحلة واحدة فقط في كل دورة عمل، ثم قدم تقريرًا واضحًا قبل الانتقال.
5. لا تستخدم أرقام مستخدمين أو تقييمات أو شهادات أو ادعاءات نجاح وهمية.
6. لا تنسخ اسم أو شعار أو موسيقى أو تصميم برنامج «من سيربح المليون».
7. لا تضع كلمة مرور قاعدة البيانات أو مفاتيح JWT أو SMTP أو Storage داخل Git.
8. لا تجعل Frontend يتصل بقاعدة البيانات مباشرة.
9. لا تسمح للمتصفح بحساب الدرجة النهائية أو تحديد صحة الإجابة.
10. لا تطبق Entity Framework Migrations تلقائيًا عند تشغيل Production.
11. لا تضف MediatR أو AutoMapper أو Redis أو Docker أو أي مكتبة كبيرة بلا حاجة فعلية.
12. لا تنشئ Microservices؛ المطلوب Modular Monolith واضح وقابل للتقسيم لاحقًا.
13. عند وجود قرار غير محدد، اختر أبسط حل آمن وسجل القرار في `docs/decisions/`.
14. كل مرحلة يجب أن تنتهي بـ:
    - Lint ناجح للواجهة.
    - Typecheck ناجح للواجهة.
    - Build ناجح للواجهة والباك إند.
    - الاختبارات المتعلقة بالمرحلة ناجحة.
    - تقرير بالملفات المعدلة والأوامر والنتائج والمخاطر والمتبقي.
15. لا تدّع نجاح أمر أو اختبار لم يتم تشغيله فعليًا.

---

## 2. ملخص المنتج

منصة SaaS عربية للمعلمين المستقلين والمراكز التعليمية الصغيرة. تبدأ بمحرك اختبارات ومسابقات جذاب، ثم تتوسع لاحقًا إلى إدارة الطلاب والمحتوى والدورات والتواصل والتقارير.

### الوعد الأساسي للنسخة الأولى

> يستطيع المعلم إنشاء اختبار ممتع، نشره برابط أو QR، استقبال إجابات الطلاب، معرفة النتائج، إصدار شهادة عند الاجتياز، وتشغيل استبانة أثر بعد الاختبار.

### العميل الأول

معلمة لغة إنجليزية تحتاج إلى:

- اختبارات تفاعلية لأسئلة اللغة الإنجليزية.
- انتقال واضح بعد الإجابة.
- عرض الدرجة المحققة.
- معرفة عدد الطالبات اللاتي دخلن.
- استبانة أثر من نحو 6 أسئلة قابلة للتعديل.
- شهادة إلكترونية لا تصدر إلا بعد الاجتياز.
- تقرير يمكن مشاركته مع ولي الأمر.

العميلة الأولى مستخدمة تجريبية وعميلة مؤسسة، وليست مالكة للكود أو المنصة.

---

## 3. القرار المعماري المعتمد

### 3.1 المكونات

- **Frontend:** React + TypeScript كتطبيق SPA.
- **Build Tool:** Vite.
- **Routing:** React Router.
- **Server State:** TanStack Query.
- **Styling:** Tailwind CSS مع Design Tokens.
- **Frontend Hosting:** Static build من مجلد `dist` على Vercel في التطوير والتجربة، مع مراجعة الخطة التجارية عند الإطلاق المدفوع.
- **Backend:** ASP.NET Core Web API.
- **الإصدار المستهدف:** .NET 10 LTS للمشروع الجديد.
- **Database:** PostgreSQL.
- **ORM:** Entity Framework Core + Npgsql.
- **Authentication:** ASP.NET Core Identity.
- **API Authentication:** JWT Access Token قصير العمر + Rotating Refresh Token.
- **Authorization:** Roles + Policies + Tenant Membership Guards.
- **Realtime:** ASP.NET Core SignalR.
- **Background Processing:** Outbox + ASP.NET Core BackgroundService في البداية.
- **Scheduling داخل التطبيق:** Quartz.NET عند وجود Jobs دورية تحتاج حالة ومتابعة.
- **Files:** Object Storage متوافق مع S3 خلف `IObjectStorage`.
- **Email:** مزود SMTP أو Transactional Email خلف `IEmailSender`.
- **API Documentation:** OpenAPI.
- **Backend Hosting:** Linux VPS.
- **Reverse Proxy:** Nginx أمام Kestrel.
- **Process Management:** systemd في البداية؛ Docker اختيار لاحق وليس شرطًا.
- **Backups:** `pg_dump` مجدول على السيرفر مع نسخة مشفرة خارج السيرفر.

إذا كان المستودع الحالي يستخدم إصدارًا LTS مختلفًا، لا تحدثه عشوائيًا. وثّق الوضع وقدّم خطة ترقية منفصلة.

### 3.2 شكل الاتصال

```text
Browser
  |
  | HTTPS
  v
React SPA / Vercel CDN
  |
  | HTTPS REST + SignalR
  v
api.example.com
Nginx -> ASP.NET Core API / Kestrel
             |
             +--> PostgreSQL
             +--> S3-compatible Storage
             +--> SMTP / Email Provider
             +--> Background Worker
```

### 3.3 لماذا هذا القرار؟

- كل منطق العمل والصلاحيات في مكان واحد واضح.
- الطالب لا يتعامل مباشرة مع قاعدة البيانات.
- التصحيح والمسابقات المباشرة تحت سيطرة السيرفر.
- React ينتج Frontend Static يمكن نقله إلى أي Static Hosting.
- لا توجد طبقة Server-Side JavaScript موازية للـ.NET.
- PostgreSQL وS3 يمنحان قابلية نقل عالية.
- SignalR مناسب للمسابقات اللحظية.
- يمكن استضافة API وقاعدة البيانات على VPS واحد أثناء التجربة لتقليل التكلفة.
- يمكن نقل PostgreSQL إلى خدمة Managed أو فصل Worker لاحقًا بدون إعادة كتابة المنصة.

### 3.4 ما لن نستخدمه في MVP

- لا Laravel.
- لا Next.js أو Server Components أو Server Actions في MVP.
- لا Supabase كـBackend مباشر.
- لا استدعاءات Database من Frontend.
- لا Redis في أول نسخة وعلى سيرفر واحد.
- لا Kubernetes.
- لا Microservices.
- لا تطبيق موبايل Native؛ المنصة Responsive/PWA أولًا.
- لا Database منفصلة لكل معلم.

### 3.5 استخدام Supabase مستقبلًا إن لزم

يمكن استخدام Supabase كاستضافة PostgreSQL أو Storage فقط، لكن:

- ASP.NET Core يظل الباك إند الوحيد.
- Frontend لا يتصل بـSupabase مباشرة.
- لا نعتمد على Supabase Auth أو RLS أو Edge Functions.
- تغيير مزود قاعدة البيانات أو Storage لا يغير عقود الـAPI.

---

## 4. بنية الحل والمستودع

### 4.1 Monorepo مقترح

```text
teacher-platform/
  apps/
    web/
      src/
      public/
      package.json
      vite.config.ts
      vercel.json
  backend/
    TeacherPlatform.sln
    src/
      TeacherPlatform.Api/
      TeacherPlatform.Application/
      TeacherPlatform.Domain/
      TeacherPlatform.Infrastructure/
    tests/
      TeacherPlatform.Domain.Tests/
      TeacherPlatform.IntegrationTests/
      TeacherPlatform.Api.Tests/
  docs/
    architecture.md
    api.md
    database.md
    deployment.md
    backup-restore.md
    decisions/
  scripts/
    deploy/
    backup/
  .github/
    workflows/
```

إذا كان المشروع الحالي منظمًا بشكل جيد، لا تعِد هيكلته لمجرد مطابقة هذا الشكل.

### 4.2 مسؤولية كل مشروع .NET

#### `TeacherPlatform.Domain`

- Entities.
- Value Objects البسيطة.
- Enums.
- قواعد المجال التي لا تحتاج I/O.
- لا EF Core.
- لا ASP.NET.
- لا Storage أو Email.

#### `TeacherPlatform.Application`

- Use Cases.
- Interfaces مثل:
  - `ICurrentUser`
  - `ITenantContext`
  - `IObjectStorage`
  - `IEmailSender`
  - `IClock`
- DTOs الداخلية.
- Validation.
- Authorization Guards.
- لا تفاصيل PostgreSQL أو Nginx.

#### `TeacherPlatform.Infrastructure`

- EF Core DbContext.
- Entity Configurations.
- Migrations.
- ASP.NET Identity stores.
- PostgreSQL implementations.
- S3 Storage implementation.
- Email implementation.
- Refresh Tokens.
- Outbox processor.

#### `TeacherPlatform.Api`

- Controllers أو Endpoint Modules.
- Authentication configuration.
- Authorization policies.
- Rate Limiting.
- ProblemDetails.
- OpenAPI.
- SignalR Hubs.
- Dependency Injection.
- Middleware.

### 4.3 قواعد تمنع التعقيد الزائد

- لا تستخدم MediatR إلا إذا كان موجودًا بالفعل وله فائدة واضحة.
- لا تستخدم Generic Repository فوق EF Core.
- استخدم `DbContext` داخل Infrastructure/Application services بطريقة منظمة.
- لا تستخدم AutoMapper في MVP؛ Mapping يدوي واضح أفضل.
- لا تجعل كل Entity لها Service وRepository بلا حاجة.
- نظم الكود حسب Features داخل Application وApi.

---

## 5. نطاق النسخة الأولى MVP

### 5.1 الأدوار

1. **Platform Admin:** مالك المنصة.
2. **Tenant Owner / Teacher:** صاحب مساحة العمل.
3. **Teacher Assistant:** يجهز دوره في الصلاحيات ويمكن تأجيل واجهته.
4. **Student / Guest Participant:** يدخل برابط أو كود بدون حساب إجباري.
5. **Parent:** لا يحتاج حسابًا في MVP؛ يحصل على تقرير خاص قابل للمشاركة.

### 5.2 المميزات الإلزامية P0

- تسجيل المعلم وتأكيد البريد واستعادة كلمة المرور.
- إنشاء مساحة عمل للمعلم.
- لوحة تحكم مختصرة.
- إنشاء وتعديل وأرشفة الاختبار.
- بنك أسئلة.
- أنواع أسئلة:
  - اختيار من متعدد.
  - صح أو خطأ.
  - إكمال فراغ/إجابة قصيرة.
  - ترتيب كلمات أو جملة.
  - سؤال استماع مع ملف صوتي.
- إضافة صورة أو صوت للسؤال.
- إعداد درجة النجاح.
- وقت السؤال أو الاختبار.
- خلط الأسئلة والاختيارات.
- معاينة قبل النشر.
- نشر نسخة ثابتة من الاختبار.
- رابط مشاركة وكود دخول وQR.
- دخول الطالب باسم عرض فقط.
- التصحيح داخل ASP.NET Core.
- عرض النتيجة ونسبة النجاح.
- إحصائيات المشاركين ونسبة الاجتياز ومتوسط الدرجات.
- تفاصيل إجابات كل مشارك.
- استبانة أثر قابلة للتعديل.
- شهادة عند الاجتياز.
- تقرير مختصر قابل للمشاركة مع ولي الأمر.
- تصميم لعبة أصلي جذاب مع مؤثرات قابلة للإيقاف.
- لوحة Platform Admin لإدارة العملاء والخطط والاستخدام.
- تصدير أسئلة ونتائج.
- Backup خارجي مجدول.

### 5.3 مميزات P1 بعد استقرار P0

- مسابقة مباشرة Teacher-led.
- Lobby ولوحة ترتيب مباشرة.
- وسائل مساعدة مثل التلميح وحذف اختيارين.
- استيراد الأسئلة من CSV/Excel.
- قوالب اختبارات جاهزة.
- نسخ اختبار.
- مجموعات طلاب بسيطة.
- Branding لكل معلم.
- صفحة عامة للمعلم.
- أكواد إحالة.

### 5.4 خارج نطاق MVP

- متجر دورات.
- الدفع الآلي.
- فصول فيديو مباشرة.
- تطبيق Android/iOS.
- AI لتوليد الأسئلة.
- تصحيح مقالات بالذكاء الاصطناعي.
- حساب كامل لولي الأمر.
- إدارة مدرسة بأقسام وفروع.
- White-label domain لكل عميل.
- نظام محاسبة أو رواتب.
- مراقبة غش متقدمة.

---

## 6. مؤشرات نجاح النسخة الأولى

يعتبر MVP صالحًا للعرض التجريبي عندما يستطيع:

1. معلم جديد التسجيل وإنشاء Workspace خلال أقل من 3 دقائق.
2. إنشاء اختبار من 10 أسئلة ونشره دون تدخل تقني.
3. 30 طالبًا على الأقل حل الاختبار من الهواتف في نفس الفترة.
4. منع الطالب من استخراج الإجابات الصحيحة من الـAPI أو Network.
5. حفظ كل محاولة حتى مع Refresh أو انقطاع مؤقت.
6. إظهار تقرير متسق مع الإجابات المخزنة.
7. إصدار الشهادة فقط عند تحقق النجاح.
8. منع معلم من الوصول إلى بيانات معلم آخر حتى لو غيّر URL أو Tenant Header.
9. استعادة نسخة Backup على بيئة اختبار.
10. عمل الواجهة جيدًا عند 390px و768px و1440px.
11. استقرار SignalR مع العدد المستهدف في اختبار حمل.

---

## 7. خريطة الصفحات

العدد المتوقع للنسخة الأولى نحو **33 شاشة منطقية**.

### 7.1 الصفحات العامة — 5

1. `/`
2. `/pricing`
3. `/t/[teacherSlug]`
4. `/privacy`
5. `/terms`

### 7.2 المصادقة والتهيئة — 4

1. `/auth/login`
2. `/auth/signup`
3. `/auth/forgot-password`
4. `/onboarding`

### 7.3 لوحة المعلم — 14

1. `/dashboard`
2. `/dashboard/quizzes`
3. `/dashboard/quizzes/new` و`/dashboard/quizzes/[id]/edit`
4. `/dashboard/questions`
5. `/dashboard/quizzes/[id]/preview`
6. `/dashboard/quizzes/[id]/publish`
7. `/dashboard/sessions`
8. `/dashboard/sessions/[id]/host`
9. `/dashboard/reports/[sessionId]`
10. `/dashboard/attempts/[attemptId]`
11. `/dashboard/surveys`
12. `/dashboard/certificates`
13. `/dashboard/learners`
14. `/dashboard/settings`

### 7.4 تجربة الطالب — 5

1. `/join`
2. `/play/[joinCode]`
3. `/play/[joinCode]/instructions`
4. `/play/[joinCode]/result`
5. `/play/[joinCode]/feedback`

تبقى أسئلة الاختبار داخل Route واحد مع State واضحة، وليس Route مستقلًا لكل سؤال.

### 7.5 إدارة المنصة — 5

1. `/platform`
2. `/platform/tenants`
3. `/platform/users`
4. `/platform/plans`
5. `/platform/usage`

---

## 8. تصميم الـAPI

### 8.1 قواعد عامة

- Base path: `/api/v1`.
- استخدم DTOs ولا ترجع EF Entities للواجهة.
- كل Endpoint يعيد Status Code صحيحًا.
- الأخطاء بصيغة `ProblemDetails`.
- Pagination إلزامية للقوائم.
- Filtering وSorting بحدود معلومة.
- كل Date/Time في الـAPI بصيغة UTC ISO 8601.
- لا تقبل `tenant_id` داخل Body كدليل صلاحية.
- استخرج المستخدم من Access Token.
- استخرج Tenant المطلوب ثم تحقق من Membership داخل السيرفر.
- العمليات الحساسة تستخدم Transaction.
- عمليات التكرار المحتملة تكون Idempotent.
- أنشئ OpenAPI Contract واستخدم Typed API Client في الواجهة.

### 8.2 Endpoints مبدئية

#### Auth

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

#### Tenants

```text
POST   /api/v1/tenants
GET    /api/v1/tenants/mine
GET    /api/v1/tenants/{tenantId}
PATCH  /api/v1/tenants/{tenantId}
GET    /api/v1/tenants/{tenantId}/members
POST   /api/v1/tenants/{tenantId}/members
```

#### Questions

```text
GET    /api/v1/tenants/{tenantId}/questions
POST   /api/v1/tenants/{tenantId}/questions
GET    /api/v1/tenants/{tenantId}/questions/{questionId}
PUT    /api/v1/tenants/{tenantId}/questions/{questionId}
DELETE /api/v1/tenants/{tenantId}/questions/{questionId}
```

#### Quizzes

```text
GET    /api/v1/tenants/{tenantId}/quizzes
POST   /api/v1/tenants/{tenantId}/quizzes
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}
PUT    /api/v1/tenants/{tenantId}/quizzes/{quizId}
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/publish
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions
```

#### Player

```text
GET    /api/v1/player/sessions/{joinCode}
POST   /api/v1/player/sessions/{joinCode}/join
POST   /api/v1/player/attempts
GET    /api/v1/player/attempts/{attemptToken}/current-question
POST   /api/v1/player/attempts/{attemptToken}/answers
POST   /api/v1/player/attempts/{attemptToken}/finish
GET    /api/v1/player/attempts/{attemptToken}/result
```

#### Reports

```text
GET    /api/v1/tenants/{tenantId}/sessions/{sessionId}/report
GET    /api/v1/tenants/{tenantId}/attempts/{attemptId}
GET    /api/v1/tenants/{tenantId}/reports/export
```

#### Surveys and Certificates

```text
GET    /api/v1/tenants/{tenantId}/surveys
POST   /api/v1/tenants/{tenantId}/surveys
POST   /api/v1/player/attempts/{attemptToken}/survey
GET    /api/v1/player/certificates/{publicToken}
```

### 8.3 Frontend API Client

- يوجد مكان واحد فقط لإعداد Base URL والـHeaders.
- Access Token لا يخزن في `localStorage` إن أمكن؛ يحتفظ به في الذاكرة.
- Refresh Token داخل `HttpOnly + Secure` Cookie.
- عند 401 ينفذ Refresh مرة واحدة ثم يعيد الطلب.
- لا تنشئ Infinite Refresh Loop.
- يولد Types من OpenAPI أو يراجع يدويًا مع Contract Tests.

---

## 9. المصادقة والأمان

### 9.1 ASP.NET Core Identity

استخدم:

- `ApplicationUser : IdentityUser<Guid>`
- `ApplicationRole : IdentityRole<Guid>`
- Email confirmation.
- Password reset.
- Lockout بعد محاولات فاشلة.
- Password policy مناسبة وغير مبالغ فيها.
- Security Stamp.

### 9.2 Access وRefresh Tokens

#### Access Token

- عمر مقترح 10–15 دقيقة.
- يحتوي:
  - User ID.
  - Token ID.
  - Platform role عند الحاجة.
- لا تضع قائمة Tenant IDs الكبيرة داخله؛ تحقق من Membership من DB/Cache.

#### Refresh Token

- Random cryptographically secure.
- لا يخزن Raw في Database؛ يخزن Hash.
- داخل HttpOnly Secure Cookie.
- Rotation عند كل Refresh.
- Revoke للسلسلة عند اكتشاف إعادة استخدام Token قديم.
- جدول مستقل يسمح بتسجيل الجهاز وتاريخ الانتهاء والإلغاء.

### 9.3 CORS وCookies

- Production Origins محددة صراحة.
- لا تستخدم `AllowAnyOrigin` مع Credentials.
- اضبط `app.example.com` و`api.example.com`.
- Preview origins تدار عبر Configuration منفصلة.
- تحقق من `Origin` في Refresh والعمليات الحساسة.
- اضبط `SameSite` وفق شكل الدومينات بعد اختبار فعلي.

### 9.4 Rate Limiting

استخدم ASP.NET Core Rate Limiting على:

- Login.
- Forgot Password.
- Join Session.
- Submit Answer.
- Public Report.
- Export.

اجعل الحدود حسب IP والمستخدم وJoin Code عند الحاجة.

### 9.5 Data Protection

- مفاتيح ASP.NET Data Protection تحفظ خارج مجلد الإصدار.
- لا تضيع عند كل Deployment.
- صلاحيات الملفات مقيدة لمستخدم الخدمة.

---

## 10. تعدد العملاء Multi-tenancy

### 10.1 النموذج

- Shared Database.
- Shared Schema.
- كل جدول يخص عميلًا يحتوي `TenantId`.
- المستخدم يمكن أن يكون عضوًا في أكثر من Tenant.
- لا تنشئ Database أو VPS لكل معلم.

### 10.2 Tenant Resolution

الواجهة ترسل Tenant المطلوب عبر Route أو Header مثل `X-Tenant-Id`.

السيرفر:

1. يقرأ User ID من Token.
2. يقرأ Tenant ID المطلوب.
3. يبحث عن Membership فعالة.
4. ينشئ `TenantContext` للطلب.
5. يرفض الطلب قبل الوصول للخدمة إذا لا توجد عضوية.

Header ليس دليل صلاحية؛ هو اختيار Tenant فقط.

### 10.3 EF Core Global Query Filters

- كل Entity تطبق `ITenantEntity`.
- `AppDbContext` يحصل على `ITenantContext`.
- Query Filter يضيف `TenantId == CurrentTenantId`.
- Soft Delete Filter يضيف `DeletedAt == null`.
- استخدم EF Core 10 Named Filters إذا كان ذلك مناسبًا.
- أي استخدام لـ`IgnoreQueryFilters()` يحتاج سببًا واختبارًا ومراجعة.

### 10.4 حماية الكتابة

أنشئ SaveChanges Interceptor أو منطقًا مركزيًا يقوم بـ:

- تعيين TenantId عند إضافة Entity.
- رفض تعديل Entity تخص Tenant مختلف.
- تعيين CreatedAt/UpdatedAt وCreatedBy.
- منع العميل من تغيير TenantId.

### 10.5 Defense in Depth

- Composite Unique Constraints تشمل TenantId.
- Foreign Keys لا تسمح بربط بيانات Tenants مختلفة.
- Integration Tests للعزل.
- قاعدة البيانات غير مكشوفة للإنترنت العام إن أمكن.
- PostgreSQL RLS يمكن إضافتها لاحقًا للجهات الكبيرة، لكنها ليست مطلوبة في MVP لأن API هو منفذ البيانات الوحيد.

---

## 11. تصميم قاعدة البيانات

### 11.1 قواعد عامة

كل جدول يخص عميلًا يحتوي:

- `Id uuid`
- `TenantId uuid`
- `CreatedAt timestamptz`
- `UpdatedAt timestamptz`
- `CreatedBy uuid null`
- `DeletedAt timestamptz null` عند الحاجة

قواعد:

- استخدم `Guid`/UUID للمفاتيح المكشوفة.
- كل التواريخ UTC.
- لا تخزن Binary داخل PostgreSQL.
- لا تستخدم JSONB للعلاقات أو النتائج الأساسية.
- استخدم JSONB لإعدادات نوع السؤال أو Theme فقط.
- أضف Indexes للمفاتيح الخارجية والبحث.
- لا تعتمد على Cascade Delete لبيانات المحاولات والنتائج الحساسة.
- استخدم Optimistic Concurrency في `LiveSessionState` والـDrafts المهمة.

### 11.2 EF Core Migrations

ترتيب مقترح:

```text
20260731_InitialIdentity
20260731_CreateTenantsAndMemberships
20260801_CreatePlansAndSubscriptions
20260801_CreateEducationReferences
20260802_CreateMediaAssets
20260803_CreateQuestionBank
20260804_CreateQuizVersions
20260805_CreateSessionsAttemptsAnswers
20260806_CreateSurveys
20260806_CreateCertificates
20260807_CreateNotificationsOutboxAudit
20260808_AddReportingIndexesAndViews
```

القواعد:

- لا تعدّل Migration تم تطبيقها على Production.
- راجع SQL الناتج قبل النشر.
- أنشئ Migration Bundle أو Idempotent Script.
- خذ Backup قبل Migration إنتاجية مؤثرة.
- لا تشغل `Database.Migrate()` تلقائيًا في Production.

### 11.3 Identity

جداول ASP.NET Identity القياسية بالإضافة إلى:

#### `UserProfiles`

- `UserId`
- `FullName`
- `AvatarObjectKey`
- `Locale`
- `Status`

#### `RefreshTokens`

- `UserId`
- `TokenHash`
- `FamilyId`
- `ExpiresAt`
- `CreatedAt`
- `RevokedAt`
- `ReplacedByTokenId`
- `CreatedByIp`
- `UserAgent`

### 11.4 العملاء والصلاحيات

#### `Tenants`

- `Name`
- `Slug`
- `OwnerUserId`
- `CountryCode`
- `Timezone`
- `DefaultLocale`
- `Status`

#### `TenantMemberships`

- `TenantId`
- `UserId`
- `Role`: `Owner | Teacher | Assistant | Viewer`
- `Status`
- Unique: `(TenantId, UserId)`

#### `TenantSettings`

- `TenantId` Unique
- `LogoObjectKey`
- `PrimaryColor`
- `SecondaryColor`
- `PublicTeacherName`
- `CertificateSignatureObjectKey`
- `SettingsJson`

### 11.5 الخطط والاستخدام

#### `Plans`

- `Code`
- `Name`
- `IsActive`
- `LimitsJson`

#### `Subscriptions`

- `TenantId`
- `PlanId`
- `Status`
- `StartsAt`
- `EndsAt`
- `PaymentProvider` nullable
- `ExternalReference` nullable

في MVP يتم التفعيل يدويًا من Platform Admin.

#### `UsageCounters`

- `TenantId`
- `PeriodStart`
- `PeriodEnd`
- `Metric`
- `Value`
- Unique: `(TenantId, PeriodStart, Metric)`

أمثلة:

- `PublishedQuizzes`
- `Attempts`
- `StorageBytes`
- `CertificatesIssued`

### 11.6 البيانات التعليمية المرجعية

ابدأ بالحد الأدنى:

- `Countries`
- `Curricula`
- `Grades`
- `Subjects`

الجداول التالية Phase 2:

- `Courses`
- `Units`
- `Lessons`
- `ClassGroups`
- `Enrollments`

### 11.7 الملفات

#### `MediaAssets`

- `TenantId`
- `Provider`
- `Bucket`
- `ObjectKey`
- `MimeType`
- `SizeBytes`
- `Kind`
- `Status`
- `MetadataJson`

لا تخزن Signed URL؛ خزّن ObjectKey، وأنشئ رابطًا مؤقتًا عند الحاجة.

### 11.8 بنك الأسئلة والإصدارات

#### `QuestionBanks`

- `TenantId`
- `Name`
- `Description`

#### `Questions`

- `TenantId`
- `BankId`
- `Status`
- `CurrentVersionId`

#### `QuestionVersions`

- `TenantId`
- `QuestionId`
- `VersionNumber`
- `QuestionType`
- `Prompt`
- `Explanation`
- `Difficulty`
- `Language`
- `ConfigJson`
- `MediaAssetId`

نسخة السؤال تصبح Immutable بعد دخولها في Quiz منشور.

#### `QuestionOptions`

- `TenantId`
- `QuestionVersionId`
- `SortOrder`
- `OptionText`
- `MediaAssetId`
- `IsCorrect`
- `Weight`

#### `QuestionTags` و`QuestionTagLinks`

للبحث والتنظيم.

### 11.9 الاختبارات والإصدارات

#### `Quizzes`

- `TenantId`
- `Title`
- `Slug`
- `Description`
- `Status`: `Draft | Published | Archived`
- `CurrentDraftVersionId`
- `CurrentPublishedVersionId`
- `SubjectId`
- `GradeId`

#### `QuizVersions`

- `TenantId`
- `QuizId`
- `VersionNumber`
- `Status`: `Draft | Published | Retired`
- `TitleSnapshot`
- `DescriptionSnapshot`
- `InstructionsSnapshot`
- `PassingPercentage`
- `SettingsJson`
- `PublishedAt`
- `Checksum`

#### `QuizVersionItems`

- `TenantId`
- `QuizVersionId`
- `QuestionVersionId`
- `SortOrder`
- `Points`
- `IsRequired`
- Unique: `(QuizVersionId, SortOrder)`

#### قاعدة النشر

داخل Transaction:

1. تحقق من Membership والصلاحية.
2. تحقق من الخطة وحدود الاستخدام.
3. تحقق من صلاحية الأسئلة.
4. ثبّت Question Versions.
5. أنشئ Quiz Version منشورة Immutable.
6. احسب Checksum.
7. حدث CurrentPublishedVersionId.
8. أنشئ Draft جديدة للتعديلات القادمة.

أي Attempt يرتبط بـ`QuizVersionId` وليس `QuizId` فقط.

### 11.10 الجلسات والمحاولات

#### `QuizSessions`

- `TenantId`
- `QuizVersionId`
- `Mode`: `SelfPaced | Live`
- `Status`: `Scheduled | Lobby | Active | Finished | Cancelled`
- `JoinCode`
- `ScheduledAt`
- `StartedAt`
- `EndedAt`
- `SettingsSnapshot`

#### `SessionParticipants`

- `TenantId`
- `SessionId`
- `LearnerId` nullable
- `UserId` nullable
- `DisplayName`
- `GuestTokenHash`
- `JoinedAt`

#### `Attempts`

- `TenantId`
- `SessionId`
- `ParticipantId`
- `QuizVersionId`
- `Status`
- `StartedAt`
- `SubmittedAt`
- `Score`
- `MaxScore`
- `Percentage`
- `Passed`
- `DurationMs`

#### `AttemptAnswers`

- `TenantId`
- `AttemptId`
- `QuizVersionItemId`
- `AnswerJson`
- `IsCorrect`
- `ScoreAwarded`
- `ResponseMs`
- `AnsweredAt`
- Unique: `(AttemptId, QuizVersionItemId)`

#### `PowerUpUsages`

- `TenantId`
- `AttemptId`
- `QuizVersionItemId`
- `PowerUpType`
- `UsedAt`

#### `LiveSessionStates`

- `TenantId`
- `SessionId` Unique
- `CurrentItemId`
- `QuestionStartedAt`
- `Revision`
- `StateJson`

### 11.11 الطلاب

#### `Learners`

- `TenantId`
- `DisplayName`
- `ExternalCode` nullable
- `Email` nullable
- `Status`

لا تجمع تاريخ ميلاد أو عنوانًا أو معلومات ولي أمر بلا حاجة وموافقة.

### 11.12 الاستبانات والشهادات

#### الاستبانات

- `Surveys`
- `SurveyQuestions`
- `SurveyOptions`
- `SurveyResponses`
- `SurveyAnswers`

تدعم:

- Rating.
- اختيار واحد.
- نص قصير.
- 6 أسئلة لسيناريو العميل الأول.

#### الشهادات

- `CertificateTemplates`
- `Certificates`

`Certificates`:

- `TenantId`
- `AttemptId`
- `TemplateId`
- `CertificateNumber`
- `PublicTokenHash`
- `IssuedAt`
- `FileAssetId` nullable
- Unique: `(AttemptId)`
- Unique: `(TenantId, CertificateNumber)`

إصدار الشهادة يتم بعد قراءة النتيجة من Database والتأكد أن `Passed = true`.

### 11.13 التشغيل

- `Notifications`
- `ReferralCodes`
- `ReferralEvents`
- `AuditLogs`
- `FeatureFlags`
- `OutboxMessages`
- `BackgroundJobFailures`

لا تسجل الإجابات أو الأسرار كاملة داخل Logs أو Audit.

---

## 12. التصحيح ومنع التلاعب

### 12.1 القاعدة

الـFrontend يعرض السؤال ويرسل إجابة فقط. ASP.NET Core:

1. يتحقق من Attempt Token.
2. يتحقق أن المحاولة ما زالت فعالة.
3. يتحقق أن السؤال هو السؤال المسموح حاليًا.
4. يقرأ Question Version والإجابة الصحيحة من Database.
5. يحسب النتيجة.
6. يحفظ الإجابة والدرجة داخل Transaction.
7. يعيد Feedback مسموحًا فقط.

### 12.2 عدم كشف الإجابة

Student DTO لا يحتوي:

- `IsCorrect` للخيارات.
- `Weight`.
- `Explanation` قبل الإجابة.
- أسئلة مستقبلية إذا كان الوضع يمنعها.

### 12.3 Idempotency

- Unique Constraint يمنع إجابتين لنفس السؤال في المحاولة.
- عند إعادة نفس الطلب، أعد النتيجة السابقة بدل إضافة Score جديد.
- يمكن استخدام `Idempotency-Key` للعمليات المهمة.
- Finish Attempt عملية Idempotent.

### 12.4 الوقت

- Server Time هو المرجع.
- وقت بدء السؤال والجلسة محفوظ في Database.
- Client Timer للعرض فقط.
- يوجد Grace Window صغير للشبكات البطيئة يحدد في الإعدادات.

---

## 13. SignalR والمسابقات المباشرة

### 13.1 Hub

```text
/hubs/quiz
```

Groups:

```text
tenant:{tenantId}:session:{sessionId}:teacher
tenant:{tenantId}:session:{sessionId}:players
```

### 13.2 الأحداث المقترحة

Server to Client:

- `LobbyUpdated`
- `SessionStarted`
- `QuestionOpened`
- `QuestionClosed`
- `LeaderboardUpdated`
- `SessionFinished`
- `ParticipantKicked`

Client to Server:

- لا ترسل الإجابة من Hub في MVP.
- الإجابات عبر REST Endpoint حتى يكون Transaction والتكرار أسهل.
- Hub للعرض والإشعارات وتغيير الحالة فقط.

### 13.3 الأمان

- Teacher connection تتحقق من JWT وMembership.
- Player connection تستخدم Attempt/Participant token قصير العمر.
- لا يختار Client Group بنفسه بلا تحقق.
- لا يرسل السيرفر Correct Answer قبل إغلاق السؤال.

### 13.4 التوسع

- سيرفر واحد: SignalR In-memory Hub state مع الحالة الأساسية في PostgreSQL.
- أكثر من API instance: أضف Redis Backplane.
- لا تضف Redis قبل وجود أكثر من instance أو احتياج مثبت.

---

## 14. Background Jobs وOutbox

### 14.1 لماذا Outbox؟

حتى لا تنجح عملية Database ثم يفشل إرسال البريد أو توليد الشهادة ويضيع الحدث.

داخل نفس Transaction:

1. احفظ التغيير الأساسي.
2. أضف `OutboxMessage`.
3. Background Processor يقرأ الرسالة.
4. ينفذ المهمة.
5. يسجل النجاح أو يعيد المحاولة.

### 14.2 Jobs الأولى

- إرسال Email confirmation والتنبيهات.
- توليد ملف الشهادة.
- إنشاء Tenant Export.
- تنظيف Tokens المنتهية.
- تجميع Usage Counters.
- إنهاء Attempts المهجورة.

### 14.3 التنفيذ

- ابدأ بـ`BackgroundService` داخل API.
- استخدم PostgreSQL locking لتجنب معالجة الرسالة مرتين.
- Retry محدود مع Exponential Backoff.
- Dead-letter/Failed status بعد الحد.
- عند زيادة الحمل، انقل Processor إلى `TeacherPlatform.Worker` بدون تغيير Use Cases.

### 14.4 ما لا يوضع داخل التطبيق

نسخ PostgreSQL الكامل لا يعتمد على BackgroundService داخل نفس النظام. يتم من Cron/systemd timer أو CI runner خارجي.

---

## 15. تخزين الملفات

### 15.1 Interface

```text
IObjectStorage
  UploadAsync
  OpenReadAsync
  DeleteAsync
  CreateDownloadUrlAsync
  ExistsAsync
```

### 15.2 المسارات

```text
tenant-assets/{tenantId}/questions/{assetId}/original.ext
tenant-assets/{tenantId}/branding/{assetId}/original.ext
certificates/{tenantId}/{certificateId}.pdf
exports/{tenantId}/{exportId}.zip
```

### 15.3 قواعد الأمان

- رفع الملفات يمر عبر API أو Presigned URL ينشئه API.
- تحقق من MIME type والامتداد والحجم.
- لا تثق باسم الملف من المستخدم.
- أسماء الملفات الداخلية IDs.
- Private buckets افتراضيًا.
- روابط التنزيل قصيرة العمر.
- `ObjectKey` فقط في Database.
- حذف الملف بعد التأكد أنه غير مستخدم أو عبر Job.

---

## 16. معمارية Frontend

### 16.1 هيكل مقترح

```text
apps/web/src/
  main.tsx
  app/
    App.tsx
    router.tsx
    providers.tsx
  routes/
    public/
    auth/
    dashboard/
    platform/
    play/
  pages/
  components/
    ui/
    layout/
  features/
    auth/
    tenancy/
    quizzes/
    questions/
    player/
    live-sessions/
    reports/
    surveys/
    certificates/
    platform-admin/
  data/
    api-client/
    queries/
    mutations/
  domain/
    quiz/
    scoring-display/
    permissions/
  lib/
    auth/
    validation/
    i18n/
  types/
```

### 16.2 قواعد

- TypeScript strict.
- Vite هو أداة التطوير والـBuild الوحيدة للواجهة.
- React Router مسؤول عن Nested Routes وLayouts وRoute Guards.
- استخدم Route-level lazy loading لتقليل حجم أول تحميل.
- Validation باستخدام Zod أو الموجود بالمشروع.
- React Hook Form أو النمط القائم.
- TanStack Query للـServer State إن لم يوجد بديل.
- لا يوجد Database/Supabase SDK في Frontend.
- كل الطلبات عبر Typed API Client.
- عنوان API العام فقط يوضع في `VITE_API_BASE_URL`.
- أي متغير يبدأ بـ`VITE_` يعتبر مكشوفًا للمتصفح؛ ممنوع وضع Secrets داخله.
- لا تضع منطق الدرجة داخل واجهة الطالب إلا للعرض.
- Loading وEmpty وError وUnauthorized states إلزامية.
- دعم RTL وLTR.
- احترام `prefers-reduced-motion`.

### 16.3 Authentication في الواجهة

- Access Token في Memory.
- Refresh Token Cookie لا يمكن لـJavaScript قراءتها.
- عند Reload، استدعاء Refresh/Session endpoint لاستعادة الجلسة.
- Logout يستدعي API لإلغاء Refresh Token.
- Route Guard في الواجهة لتحسين التجربة، لكن الحماية الحقيقية في API.

### 16.4 Build والنشر على Vercel

- Development: `npm run dev`.
- Production build: `npm run build`.
- ناتج الواجهة: `apps/web/dist`.
- Preview محلي للناتج: `npm run preview`.
- لا تستخدم Vercel Functions أو API Routes لمنطق العمل؛ كل المنطق في ASP.NET Core.
- أضف SPA fallback في `vercel.json` حتى تعمل روابط مثل `/dashboard` و`/play/ABC123` عند فتحها مباشرة أو عمل Refresh.
- يجب أن يختبر CI فتح Route داخلية مباشرة، وليس الصفحة الرئيسية فقط.
- ملفات Assets ذات الأسماء المحتوية على Hash تستخدم Cache طويلًا.
- `index.html` لا يأخذ Cache دائمًا حتى تصل النسخ الجديدة للمستخدمين.

مثال مبدئي يراجعه الإيجنت مع إعداد المشروع الفعلي:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

لا تضف Rewrite يمرر `/api` إلى Vercel. عنوان الـAPI يأتي من `VITE_API_BASE_URL`.

### 16.5 قرار SEO

- Dashboard وPlayer وReports لا تحتاج SEO.
- Landing وPricing وصفحة المعلم تستخدم Title وMeta وOpen Graph مناسبة.
- النسخة الأولى تقبل حدود SPA في SEO لأن الأولوية للاختبارات وتجربة المعلم.
- إذا أصبحت صفحات المعلمين أو الدورات مصدر اكتساب مهمًا، أضف Prerender للصفحات العامة أو موقع Marketing منفصلًا لاحقًا.
- لا تعِد المنصة كلها إلى Next.js قبل وجود قياس فعلي يثبت الحاجة.

---

## 17. تجربة المستخدم والتصميم

### 17.1 لوحة المعلم

- عربية RTL.
- مصطلحات بسيطة.
- Wizard لإنشاء الاختبار.
- Autosave للـDraft.
- Preview مطابق لتجربة الطالب.
- بيانات حقيقية أو Empty State فقط.

### 17.2 تجربة الطالب

- Mobile-first.
- أزرار بحد أدنى 44px.
- Progress واضح.
- Sound Toggle.
- عدم الاعتماد على اللون وحده.
- استعادة الجلسة بعد Refresh.
- رسالة واضحة عند انقطاع الاتصال.
- منع Double Click أثناء إرسال الإجابة.

### 17.3 الهوية

اسم مؤقت أصلي:

- تحدي القمة.
- سُلّم الإنجاز.
- رحلة النجوم.

ممنوع استخدام اسم البرنامج الأصلي أو شعاره أو موسيقاه أو نسخ واجهته.

---

## 18. تدفقات الاستخدام

### 18.1 التسجيل

1. Register.
2. Email confirmation.
3. Login.
4. إنشاء Tenant.
5. اختيار الدولة والمادة واللغة.
6. Founding/Free Plan.
7. Dashboard onboarding checklist.

### 18.2 إنشاء الاختبار

1. Create Quiz Draft.
2. إضافة أسئلة.
3. إعداد النجاح والوقت والخلط.
4. اختيار Theme.
5. Preview.
6. Publish عبر API.
7. إنشاء Session.
8. Link وQR.

### 18.3 دخول الطالب

1. فتح الرابط أو Join Code.
2. كتابة Display Name.
3. API ينشئ Participant وGuest Token.
4. Start Attempt.
5. الحصول على سؤال آمن.
6. إرسال الإجابة.
7. API يصحح ويحفظ.
8. Finish.
9. Result.
10. Survey.
11. Certificate عند النجاح.

### 18.4 المسابقة المباشرة

1. Teacher ينشئ Live Session.
2. Lobby.
3. الطلاب يدخلون.
4. Teacher يبدأ.
5. API يحدث Live State.
6. SignalR يرسل QuestionOpened.
7. الإجابات عبر REST.
8. API يجمع النتائج.
9. SignalR يرسل Leaderboard.
10. Teacher ينهي Session.

### 18.5 تقرير ولي الأمر

- رابط Public Token قصير العمر أو ملف.
- الاسم والاختبار والدرجة والنجاح.
- نقاط تحتاج مراجعة بدون كشف طالب آخر.
- زر مشاركة WhatsApp، دون WhatsApp API في MVP.

---

## 19. النسخ الاحتياطي والاستيراد والتصدير

### 19.1 Backup كامل

على VPS أو Runner مستقل:

1. تشغيل `pg_dump --format=custom`.
2. حساب Checksum.
3. تشفير النسخة.
4. رفعها إلى Storage خارج الـVPS.
5. نسخ Object Storage أو تفعيل Versioning حسب المزود.
6. Retention:
   - 7 نسخ يومية.
   - 4 نسخ أسبوعية.
   - 6 نسخ شهرية بعد وجود عملاء مدفوعين.
7. تنبيه عند الفشل.
8. Restore Drill شهري.

وجود PostgreSQL وAPI على نفس VPS مناسب للـPilot لكنه Single Point of Failure؛ النسخة الخارجية إلزامية.

### 19.2 Tenant Export

```text
tenant-export-YYYY-MM-DD.zip
  manifest.json
  quizzes.json
  questions.json
  surveys.json
  certificate-templates.json
  media/
```

`manifest.json`:

- `FormatVersion`
- `ExportedAt`
- `TenantId`
- `AppVersion`
- `Counts`
- `Checksums`

لا يشمل:

- Password hashes.
- Refresh Tokens.
- Secrets.
- بيانات Tenant آخر.
- Platform permissions.

### 19.3 Import

- Validate version.
- فحص الحجم والنوع.
- Dry-run.
- عدم الثقة في TenantId داخل الملف.
- Mapping للـIDs.
- إعادة ربط الملفات.
- Transaction حيث يمكن.
- Audit Log.

### 19.4 Restore Runbook

وثق:

1. إيقاف الكتابة.
2. أخذ Backup قبل الاستعادة.
3. إنشاء Database جديدة للاختبار.
4. `pg_restore`.
5. تطبيق Configuration/Secrets.
6. التحقق من Counts وChecksums.
7. تشغيل Smoke Tests.
8. تحويل الاتصال.
9. خطة رجوع.

---

## 20. Logging والمراقبة

### 20.1 Logging

- Structured Logging.
- Correlation ID لكل Request.
- UserId وTenantId عند الأمان.
- لا تسجل Password أو Token أو Correct Answer أو بيانات حساسة كاملة.
- مستويات Logs صحيحة.

### 20.2 Health Checks

```text
/health/live
/health/ready
```

Readiness تتحقق من:

- PostgreSQL.
- Storage عند الحاجة.
- Background processor status.

### 20.3 Metrics أولية

- Request duration.
- 5xx count.
- Failed login.
- Active SignalR connections.
- Answer submission latency.
- Outbox queue length.
- Failed jobs.
- Database connections.
- Backup age.

أضف Sentry/OpenTelemetry عند اقتراب Beta، ولا تجعلها تعطل Phase 0.

---

## 21. الاختبارات المطلوبة

### 21.1 Domain Unit Tests

- حساب الدرجات.
- Partial Credit.
- Passing Percentage.
- ترتيب الأسئلة.
- الوقت.
- حدود الخطط.
- Certificate eligibility.
- Idempotent answer behavior.

### 21.2 Application Tests

- Publish Quiz.
- Join Session.
- Submit Answer.
- Finish Attempt.
- Issue Certificate.
- Tenant authorization.

### 21.3 Integration Tests مع PostgreSQL

- EF Migrations من قاعدة فارغة.
- Unique constraints.
- Transactions.
- Tenant filters.
- Cross-tenant writes.
- Refresh token rotation.
- Outbox retry.

استخدم PostgreSQL حقيقيًا في الاختبارات. يمكن استخدام Testcontainers في CI، لكن لا تجعل Docker شرطًا على جهاز المستخدم إذا لم يكن متاحًا؛ وفر إعداد Test DB بديلًا.

### 21.4 API Tests

استخدم `WebApplicationFactory`:

- Auth flow.
- 401/403.
- ProblemDetails.
- Pagination.
- Publish.
- Player flow.
- Rate limits الأساسية.

### 21.5 SignalR Tests

- Teacher authorization.
- Player token.
- Join group.
- Start/next/finish events.
- Reconnect.
- عدم تسريب Event بين Sessions.

### 21.6 E2E Playwright

1. تسجيل معلم.
2. Onboarding.
3. إنشاء 3 أسئلة.
4. نشر اختبار.
5. فتح رابط الطالب في Browser Context مختلف.
6. حل الاختبار.
7. رؤية النتيجة.
8. ظهور المحاولة في التقرير.
9. ظهور الشهادة عند النجاح فقط.

### 21.7 QA

- 390px.
- 768px.
- 1440px.
- Keyboard.
- Focus.
- Contrast.
- RTL/LTR.
- Reduced Motion.
- Slow Network.

### 21.8 Load Test

- 30 طالبًا متزامنًا.
- ثم 100 بعد استقرار النظام.
- قياس:
  - API p95.
  - Answer latency.
  - SignalR connections.
  - DB connection pool.
  - CPU/RAM.
- لا تطلق Live Mode قبل الاختبار.

---

## 22. CI/CD

### 22.1 Pull Request Pipeline

#### Frontend

1. تثبيت Dependencies عبر Package Manager المعتمد.
2. `npm run lint`.
3. `npm run typecheck` أو الأمر المكافئ.
4. `npm run test`.
5. `npm run build`.
6. التأكد أن `dist` تم إنشاؤه.
7. اختبار SPA fallback وفتح Route داخلية مباشرة.

#### Backend

1. `dotnet restore`
2. `dotnet format --verify-no-changes` أو أداة التنسيق المعتمدة.
3. `dotnet build --no-restore`
4. Unit tests.
5. تشغيل PostgreSQL Test DB.
6. Integration/API tests.
7. إنشاء Migration script للتحقق.
8. Publish smoke check.

### 22.2 Deployment Backend

المسار الأبسط بدون Docker:

1. Build/Publish في CI.
2. رفع Artifact إلى مسار إصدار جديد على VPS.
3. أخذ Database Backup.
4. تطبيق Migration Bundle/Script.
5. تبديل Symlink أو مجلد Current.
6. Restart systemd service.
7. Health check.
8. Rollback للإصدار السابق عند الفشل.

### 22.3 Nginx

- HTTPS.
- Reverse proxy إلى Kestrel.
- WebSocket Upgrade لـSignalR.
- حدود حجم Upload.
- Security headers.
- Forwarded Headers مضبوطة داخل ASP.NET Core.

### 22.4 systemd

- مستخدم Linux مخصص للتطبيق.
- Auto restart.
- Environment file بصلاحيات مقيدة.
- Data Protection keys خارج Release directory.
- Logs عبر journald أو مزود منظم.

### 22.5 Database Deployment

- لا Migration تلقائية مع Startup.
- Review SQL.
- Backup قبل التغيير.
- Migration Bundle.
- Forward-only migrations قدر الإمكان.
- تغييرات كبيرة تستخدم Expand/Contract.

---

## 23. إعدادات وSecrets

أمثلة أسماء Configuration:

```text
ConnectionStrings__DefaultConnection
Jwt__Issuer
Jwt__Audience
Jwt__SigningKey
Jwt__AccessTokenMinutes
Auth__RefreshTokenDays
Cors__AllowedOrigins__0
Storage__Provider
Storage__Endpoint
Storage__Bucket
Storage__AccessKey
Storage__SecretKey
Email__Host
Email__Port
Email__Username
Email__Password
```

قواعد:

- `.env.example` أو `appsettings.Example.json` بلا قيم حقيقية.
- Secrets في GitHub/VPS secret store أو Environment file محمي.
- لا تضع Production secrets في `appsettings.json`.
- اعمل Rotation للمفاتيح عند التسريب.

---

## 24. خطة التنفيذ المرحلية

التقديرات Engineering Days لشخص واحد وليست وعدًا زمنيًا.

### Phase 0 — فحص المشروع وتأسيس الحل: 2–3 أيام

#### المهام

- فحص المستودع.
- تشغيل Baseline للواجهة والباك إن وجد.
- تثبيت قرار React + Vite + TypeScript للواجهة.
- تهيئة React Router وLayouts الأساسية دون بناء صفحات المنتج.
- تهيئة TanStack Query وTyped API Client boundary.
- إضافة `VITE_API_BASE_URL` إلى `.env.example` بلا قيمة حساسة.
- إعداد Static Vercel deployment وSPA fallback.
- تثبيت قرار .NET 10 LTS.
- إنشاء Solution/Projects حسب الحاجة.
- إعداد PostgreSQL development connection.
- إنشاء أول DbContext.
- إعداد OpenAPI وProblemDetails.
- إعداد Health Checks.
- إنشاء `docs/architecture.md`.
- إنشاء `docs/decisions/`.
- إنشاء `.env.example`/Configuration examples.
- إعداد CI أولية.

#### معايير القبول

- React/Vite Frontend يعمل محليًا.
- `npm run build` ينشئ `dist` بنجاح.
- فتح Route داخلية مباشرة لا يعيد 404 في Preview/Deployment test.
- API يعمل ويعرض Health وOpenAPI.
- الاتصال بقاعدة Test/Development يعمل.
- أول Migration تنشأ وتطبق على Database فارغة.
- لا Secrets في Git.
- Frontend لا يحتوي Database SDK مباشر ولا Next.js runtime.

### Phase 1 — Identity وMulti-tenancy: 5–7 أيام

#### المهام

- ASP.NET Identity.
- Register/Login/Refresh/Logout.
- Email confirmation/reset foundation.
- Refresh token rotation.
- Tenants/Memberships/Settings.
- Tenant Context.
- EF Global Filters.
- SaveChanges tenant guard.
- Authorization policies.
- Onboarding frontend.
- اختبارات Cross-tenant.

#### معايير القبول

- مستخدم ينشئ Workspace.
- Owner membership تنشأ.
- Refresh rotation تعمل.
- مستخدمان لا يريان بيانات بعضهما.
- تغيير Tenant Header لا يتجاوز الصلاحية.
- Platform Admin لا يمكن منحه من Profile request.

### Phase 2 — بنك الأسئلة والملفات: 6–8 أيام

#### المهام

- Media Assets.
- S3 abstraction.
- Question Bank.
- Question/Question Version.
- Options/Tags.
- أنواع P0.
- Upload صورة/صوت.
- Search/filter.
- Preview.
- Validation.

#### معايير القبول

- إنشاء وتعديل سؤال.
- Versioning صحيح.
- ملفات Tenant معزولة.
- فحص النوع والحجم.
- سؤال غير صالح لا يستخدم في النشر.

### Phase 3 — Quiz Builder والنشر: 7–9 أيام

#### المهام

- Quizzes/Versions/Items.
- Builder.
- Reorder.
- إعداد النجاح والوقت والخلط.
- Theme.
- Preview.
- Publish service داخل Transaction.
- Share/QR.
- Quotas.

#### معايير القبول

- Published Snapshot ثابتة.
- تعديل السؤال لا يغير نسخة منشورة.
- لا تجاوز للخطة من Client.
- Migration وIntegration tests ناجحة.

### Phase 4 — Player والتصحيح: 7–10 أيام

#### المهام

- Sessions.
- Participants.
- Guest tokens.
- Attempts/Answers.
- Safe DTO.
- Server-side scoring.
- Idempotency.
- Resume.
- Timeout.
- Result.
- تصميم اللعبة الأساسي.

#### معايير القبول

- لا Correct Answers في API response.
- Double submit لا يكرر الدرجة.
- Refresh لا يضيع المحاولة.
- الدرجة تطابق Database.
- الوقت Server-authoritative.

### Phase 5 — التقارير والاستبانة والشهادة: 6–8 أيام

#### المهام

- Reports.
- Attempt details.
- Question analytics.
- Survey builder.
- Survey submission.
- Certificate records/templates.
- Outbox.
- Background processor.
- Certificate rendering.
- Parent share.
- CSV export.

#### معايير القبول

- التقارير من بيانات فعلية.
- شهادة عند النجاح فقط.
- استبانة 6 أسئلة.
- Job failure قابل لإعادة المحاولة.
- لا كشف لبيانات طالب آخر.

### Phase 6 — Live Competition بـSignalR: 6–9 أيام

#### المهام

- QuizHub.
- Lobby.
- Host screen.
- Live state.
- Groups authorization.
- Timer.
- REST answers.
- Aggregated leaderboard.
- Reconnect.
- Load tests.

#### معايير القبول

- 30 مستخدمًا متزامنًا أولًا.
- Reconnect لا يكرر Participant/Attempt.
- Teacher فقط يتحكم.
- لا Correct Answer قبل الإغلاق.
- Session لا تستقبل Events من Session أخرى.

### Phase 7 — SaaS Admin والتشغيل: 6–8 أيام

#### المهام

- Plans.
- Subscriptions.
- Usage.
- Platform Admin.
- Manual activation.
- Audit.
- Referral foundation.
- Backup scripts.
- Export/Import.
- Nginx/systemd docs.
- Deployment pipeline.
- SMTP.

#### معايير القبول

- تفعيل خطة يدويًا.
- الحدود Server-side.
- Backup مجدول.
- Restore ناجح.
- Health checks بعد Deployment.
- Rollback موثق.

### Phase 8 — Hardening وBeta: 5–8 أيام

#### المهام

- مراجعة Authorization.
- E2E.
- Accessibility.
- Performance.
- Empty/Error states.
- Mobile QA.
- Monitoring.
- Privacy/Terms.
- Onboarding أول 3–5 معلمين.

#### معايير القبول

- نجاح مؤشرات MVP.
- لا توجد مشاكل P0.
- Runbooks للأعطال والاستعادة.

### التقدير الإجمالي

نحو **50–70 يوم عمل هندسي** لشخص واحد للحصول على SaaS MVP محترم، وقد تزيد المدة عند العمل الجزئي أو التغييرات المتكررة.

---

## 25. الأولويات

### P0 — لا إطلاق بدونها

- Identity آمنة.
- Tenant isolation.
- Question/Quiz versioning.
- Server-side scoring.
- Self-paced player.
- Reports.
- Survey.
- Conditional certificate.
- Backup/Restore.
- Mobile usability.

### P1 — بعد Beta

- Live mode.
- Import Excel.
- Branding.
- Learner groups.
- Referral tracking.

### P2 — بعد وجود دخل

- Payment gateway.
- Courses/Lessons.
- Parent accounts.
- Academy teams.
- AI.
- Mobile app.

---

## 26. نقاط التوسع المستقبلية

### عند زيادة مستخدمي SignalR

- تشغيل أكثر من API instance.
- Redis Backplane.
- Sticky sessions عند الحاجة.
- فصل Realtime monitoring.

### عند زيادة Background Jobs

- نقل Outbox processor إلى Worker Service منفصلة.
- إضافة Queue متخصصة عند الحاجة.

### عند زيادة Database

- نقل PostgreSQL إلى Managed Service.
- Read replicas للتقارير عند الحاجة.
- أرشفة Events القديمة.
- لا Sharding مبكر.

### عند متطلبات خليجية أو مدارس

- مراجعة موقع استضافة البيانات.
- Audit أوسع.
- Consent/Delete/Export.
- فصل Tenant في Database مستقلة فقط للعملاء الذين يدفعون مقابل ذلك.

---

## 27. قائمة ما قبل الإطلاق

### الأمن

- [ ] لا Database access من Frontend.
- [ ] لا Secrets في Git.
- [ ] JWT validation صحيحة.
- [ ] Refresh rotation/revoke.
- [ ] CORS محدد.
- [ ] Rate limiting.
- [ ] Tenant filters/guards.
- [ ] لا Correct Answer في Player DTO.
- [ ] Storage private.
- [ ] Data Protection keys ثابتة.

### البيانات

- [ ] Migrations من Database فارغة.
- [ ] Backup ناجح.
- [ ] Restore ناجح.
- [ ] Tenant export معزول.
- [ ] Indexes للتقارير.
- [ ] لا Cascade Delete خطر.

### المنتج

- [ ] إنشاء ونشر اختبار.
- [ ] حل من الهاتف.
- [ ] تقرير صحيح.
- [ ] استبانة.
- [ ] شهادة.
- [ ] Empty states.
- [ ] لا بيانات أو ادعاءات وهمية.

### التشغيل

- [ ] Nginx HTTPS.
- [ ] SignalR WebSocket proxy.
- [ ] systemd auto restart.
- [ ] Health checks.
- [ ] SMTP.
- [ ] Logs.
- [ ] Backup alert.
- [ ] Rollback.
- [ ] Privacy/Terms.

---

## 28. Definition of Done

لا تعتبر المهمة مكتملة إلا إذا:

1. تحقق Acceptance Criteria.
2. DTOs وValidation موجودة.
3. Authorization داخل API.
4. Transaction/Idempotency عند الحاجة.
5. Loading/Error/Empty في الواجهة.
6. الاختبارات المناسبة ناجحة.
7. Build ناجح.
8. لا Console/Server errors جديدة.
9. لا Secrets أو بيانات حساسة.
10. الهاتف والكمبيوتر يعملان.
11. OpenAPI والتوثيق تم تحديثهما.
12. التقرير يذكر بوضوح ما لم ينفذ.

---

## 29. صيغة تقرير الإيجنت بعد كل مرحلة

```markdown
## النتيجة
ما الذي أصبح يعمل فعليًا؟

## الملفات الرئيسية المعدلة
- path: السبب

## Backend وDatabase
- Endpoints
- Migrations
- Authorization
- Jobs/SignalR

## التحقق المنفذ
- command: result

## قرارات أو افتراضات
- القرار وسببه

## المتبقي والمخاطر
- عناصر واضحة

## الخطوة التالية
- المرحلة التالية فقط
```

---

## 30. المهمة الأولى التي تُعطى للإيجنت

انسخ الرسالة التالية مع إرفاق هذه الوثيقة:

> اقرأ ملف `teacher-saas-implementation-plan-ar.md` كاملًا، ثم افحص المستودع الحالي دون تعديل. بعد الفحص نفّذ **Phase 0 فقط** وفق الإصدار 2.1 من الوثيقة. الواجهة الرسمية هي React + Vite + TypeScript كتطبيق SPA، والباك إند الرسمي هو ASP.NET Core. حافظ على أي عمل موجود، ولا تبدأ Auth أو تصميم صفحات المنتج قبل تثبيت React Router وAPI Client boundary وStatic deployment من جهة الواجهة، وتثبيت Solution structure وPostgreSQL وOpenAPI وHealth Checks وConfiguration وCI من جهة الباك إند. شغّل Baseline قبل التعديل، ولا تجعل Docker شرطًا إذا لم يكن موجودًا على جهاز المستخدم. لا تستخدم Next.js أو Supabase SDK في Frontend، ولا تنشئ اتصال Database من المتصفح، ولا تضع Secret حقيقيًا، ولا تطبق Migration تلقائيًا في Production. اختبر أن Refresh على Route داخلية في Vercel لا يعطي 404. في النهاية قدم التقرير بالصيغة المحددة في القسم 29 وتوقف للمراجعة.

---

## 31. مراجع تقنية رسمية

- React: https://react.dev/
- React with Vite: https://react.dev/learn/build-a-react-app-from-scratch
- Vite: https://vite.dev/
- Vite Static Deployment: https://vite.dev/guide/static-deploy
- React Router: https://reactrouter.com/
- React Router Routing: https://reactrouter.com/start/declarative/routing
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Rewrites: https://vercel.com/docs/routing/rewrites
- .NET Support Policy: https://learn.microsoft.com/en-us/dotnet/core/releases-and-support
- ASP.NET Core Hosting: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/
- Linux + Nginx: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/linux-nginx
- ASP.NET Core Identity: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity
- JWT Bearer Authentication: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/
- Rate Limiting: https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit
- SignalR: https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction
- SignalR Scaling: https://learn.microsoft.com/en-us/aspnet/core/signalr/scale
- EF Core Multi-tenancy: https://learn.microsoft.com/en-us/ef/core/miscellaneous/multitenancy
- EF Core Global Query Filters: https://learn.microsoft.com/en-us/ef/core/querying/filters
- EF Core Migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
- Applying Migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying
- ASP.NET Core Health Checks: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks
- ASP.NET Core OpenAPI: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/overview

---

**القاعدة الحاكمة:** Frontend للعرض والتفاعل، ASP.NET Core هو صاحب القرار، PostgreSQL هو مصدر الحقيقة، وأي توسع يجب أن يأتي بعد قياس حاجة فعلية.
