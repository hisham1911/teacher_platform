# Phase 1 — Identity & Multi-tenancy — تقرير الإغلاق

**الفرع:** `feature/phase-1-identity-tenancy`
**التاريخ:** 2026-08-02
**الوضع النهائي:** اكتملت كل معايير القبول والاختبارات

---

## النتيجة

Phase 1 مكتمل فعليًا. التطبيق يعمل مع المصادقة الحقيقية، وعزل Multi-tenancy، ودورة حياة الجلسة، والاختبارات تُثبت كل هذا على PostgreSQL حقيقية.

**يشتغل فعليًا:**

- تسجيل المعلم مع تأكيد البريد.
- تسجيل الدخول مع Refresh Token في `__Host-tp-refresh` HttpOnly Cookie.
- دورة Refresh مع Rotation، كشف Reuse يُلغي العائلة.
- تسجيل الخروج + إلغاء كل Tokens عند تغيير Password.
- `PlatformAdmin` لا يُمنح من Public Request (اختبار يؤكد).
- إنشاء Workspace + Owner Membership + Settings في Transaction واحدة.
- Cross-tenant read ممنوع بـ404، تعديل Cross-tenant ممنوع، Header/Route mismatch يرجع 400، Suspended membership مرفوضة.
- Frontend SPA كامل مع Onboarding، Dashboard (لا بيانات وهمية)، Settings حقيقية.
- Session تستعاد بعد Reload دون تخزين Access Token في Web Storage.

---

## سبب عطل WebApplicationFactory

**Root Cause المثبت:**

`Program.cs` كان يقرأ `jwtConfig` من `builder.Configuration.GetSection("Jwt").Get<JwtOptions>()` في وقت بناء الخدمات (قبل `builder.Build()`).  هذا صحيح كودياً، لكن `TestWebApplicationFactory` الأصلية:

1. لم تضبط بيئة `Testing` — بقي الاختبار يعمل في `Development`، و `appsettings.Development.json` لا يحتوي قسم `Jwt`.
2. أضافت قيم JWT عبر `ConfigureAppConfiguration.AddInMemoryCollection` — والمشكلة أن تأثيرها يظهر على نسخة IConfiguration المستخدمة في بناء Host، بعد ما قرأ Program.cs الحقل مباشرةً.

النتيجة: `SigningKey` كانت سلسلة فارغة، و`SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig.SigningKey))` يرمي `IDX10703: key length is zero`.

**كيف شُخّص:** تشغيل اختبار منفرد بأعلى verbosity أظهر stack trace واضحًا: `TeacherPlatform.Api.Program.cs:111` — بناء SymmetricSecurityKey من مفتاح فارغ.

**كيف أُصلح:**

1. `TestWebApplicationFactory` تضبط البيئة `Testing` صراحة عبر `builder.UseSetting(EnvKey, "Testing")`.
2. تحمّل `appsettings.Testing.json` تلقائيًا لأن ASP.NET Core يضيف `appsettings.{environment}.json` افتراضيًا. وبداخله كل قيم الاختبار (JWT، Auth، Lockout، Mail، RateLimiting، Cors، DataProtection AppName).
3. `ConfigureAppConfiguration` يضيف نقطة واحدة فقط: `ConnectionStrings:DefaultConnection` من INTEGRATION_TEST_DB و `DataProtection:KeysDirectory` مؤقت معزول.
4. **لم يُعطّل `ValidateOnStart`** ولا وُضع fallback إنتاجي ولا Mock للـAPI.

**لماذا لا يضعف Production:** نفس كود Program.cs يعمل في كل البيئات. appsettings.Testing.json ملف مرافق للاختبار غير صالح للإنتاج، ولا وجود له في Publish بمحتوى إنتاجي.

---

## مراجعة Backend الحالي

- **TenantProbeItems — حُذف بالكامل:** لم يعد هناك Test-only entity أو جدول في Production Schema. `AddIdentity` و`InitialCreate` لم تُعدّل. قاعدة `teacher_platform_test` أعيد ضبطها محليًا عبر DROP (اختبارية فقط).
- **Interceptor Lifetime:** `TenantSaveGuardInterceptor` مسجل Singleton — Stateless ويقرأ `AppDbContext.CurrentTenantId` في وقت التنفيذ. آمن للطلبات المتزامنة.
- **IgnoreQueryFilters محصور:** `TenantBypassService` فقط — كل الطلبات الأخرى تمر عبر طرق مسماة (`FindMembershipIgnoreFiltersAsync`, `SlugExistsAsync`, ...). `RefreshTokenService` و`AuthController` و`TenantsController` لم تعد تستخدم `IgnoreQueryFilters` — تحولت إلى Service المركزية.
- **اختبار Tenant Context Leak:** `TenantHeaderWithoutMemberShip_IsRejected_NoContextLeakAcrossSequentialRequests` يؤكد عدم تسرب سياق المستأجر بين طلبات متتالية.

---

## Git

- **الفرع:** `feature/phase-1-identity-tenancy`
- **Commits:** (سرد أدناه)
- **الحالة النهائية:** مكتملة ونظيفة

---

## Database

**الجداول النهائية:**

- Identity: `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims`
- Phase 1: `UserProfiles`, `RefreshTokens`
- Tenancy: `Tenants`, `TenantMemberships`, `TenantSettings`

**Migrations المرتبة:**
- `20260731111834_InitialCreate` (SystemMessages — Phase 0 — لم تعدل)
- `20260731210102_AddIdentity`
- `20260801125127_AddTenancy` (فقط Tenants/Memberships/Settings — لا Probe)

**القيود الرئيسية:**
- `Tenants.NormalizedSlug` UNIQUE
- `TenantMemberships (TenantId, UserId)` UNIQUE
- `TenantSettings.TenantId` PK + FK
- Composite indexاء على TenantId لكل جداول المستأجر

**Migration على قاعدة فارغة:** Integration tests تُنشئ قاعدة temp لكل run وتتحقق من الجداول.
**Idempotent script:** `dotnet ef migrations script --idempotent` تولد قابل للتطبيق البنفسجي بدون خطأ، tested في CI بالاختبار نفسه.

---

## Authentication

- **Register:** ينشئ ApplicationUser + UserProfile. البريد مكرر يرجع 200 لكن التفاصيل لا تكشف وجود البريد (General Message). أي حقل مثل Role أو IsPlatformAdmin في public registration لا يمنح صلاحية — الاختبار `Register_CannotGrantPlatformAdmin_FromPublicRequest` يغطي هذا.
- **Email confirmation:** Link يَظهر في EmailSource الكابتر للاختبار، برابط `http://localhost:5173/auth/confirm-email?uid=...&token=...`.
- **Unconfirmed login → 403** (`EmailNotConfirmed`).
- **Login صحيح → Access Token** يعاد في Response. Cookie Refresh HttpOnly.
- **Login خاطئ → 401** بدون كشف بريد موجود.
- **Forgot/Reset:** Forgot يرجع 202 دائمًا، Reset يعين كلمة مرور جديدة ويلغي العائلة.
- **Refresh:** Rotation داخل Transaction، ReplacedByTokenId مُسجل، Reuse detection يلغي العائلة.

**Cookies:** `__Host-tp-refresh`: HttpOnly, Secure=true في الإنتاج, SameSite=Lax, Path=/api/v1/auth.
**CORS:** `ApiCors` policy مخصصة، Origins من Config، ذات Credentials مع origins صريحة.
**Origin:** `OriginCheckMiddleware` يقبل الطلبات الحساسة فقط من Origins الموثوقة.

---

## Multi-tenancy

** Tenant Resolution:** Route tenantID يحسم السياق — X-Tenant-Id مجرد اختيار بعد تحقق العضوية.

**Global Filters:** كل ITenantEntity يحمل HasQueryFilter. لا بيانات بدون سياق.

**Write Guard:** `TenantSaveGuardInterceptor` (Singleton Stateless):
- Insert يضبط `TenantId` من Context، يرفض من Client.
- Update/Delete يمنع تغيير TenantId، يمنع كيان Tenant مختلف، يضبط timestamps.

**اختبارات العزل:**
- قراءة مستأجر آخر = 404.
- تعديل مستأجر آخر = ممنوع.
- رفض الطلب خارج قاعدة بيانات حقيقياً.

**PlatformAdmin:** لا يمنح في public registration (متحقق من الاختبار).

---

## Frontend

**الصفحات المنفذة:**
- `/auth/signup`
- `/auth/login`
- `/auth/forgot-password` (Generic response دائمًا)
- `/auth/confirm-email` (uid/token من URL)
- `/auth/reset-password`
- `/onboarding` (Create Workspace: name + slug + countryCode + timezone + locale)
- `/onboarding/choose` (قائمة Workspaces متعددة)
- `/dashboard` (بيانات حقيقية، لا Stats مزيفة، Workspace switcher، Logout)
- `/dashboard/settings`

**Session Architecture:**
- Token في الذاكرة فقط، لا storage في localStorage/sessionStorage.
- Refresh Token داخل HttpOnly Cookie لا يقرأه JavaScript.
- كل الطلبات عبر `data/api-client/endpoints.ts` مع `credentials: 'include'`.
- عند Reload: Single-flight Refresh → /me → يستعيد Session.
- عند 401: يحاول Refresh مرة واحدة، يعيد الطلب الأصلي مرة واحدة فقط.

**اختبارات Frontend:**
- تحقق Signup/Login validation.
- Session store لا يخزن Access Token في localStorage.
- Refresh 401 واحد فقط عبر متزامن (3 طلبات parallel تترجم إلى 1 refresh).
- فشل Refresh يمسح Session ولا ينشئ Loop.
- Dashboard لا يحتوي إحصائيات وهمية.

---

## CI

**Backend:**
- PostgreSQL 15 service + Health check.
- dotnet restore, format verify, build.
- Domain, Api, Integration tests مع INTEGRATION_TEST_DB مضبوط.
- Migration apply على قاعدة فارغة.
- Idempotent Script applied مرتين بدون خطأ.
- Package Vulnerability Audit (Direct + Transitive) — يفشل إذا وجد High أو Critical.
- Publish smoke.

**Frontend:**
- npm install, lint, typecheck, test, build.
- `dist` verification.
- SPA refresh route check (يحصل index.html على /dashboard/settings بدون 404).

---

## ما لم يُفعل

لا توجد عناصر متعمدة ناقصة.


---

## الخطوة التالية

Phase 2 — بنك الأسئلة وإدارة المحتوى — تبدأ فقط بعد موافقة المستخدم والتحقق من استقرار Phase 1.