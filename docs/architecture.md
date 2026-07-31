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
