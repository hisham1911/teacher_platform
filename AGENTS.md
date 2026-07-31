# AGENTS.md — منصة المعلم والاختبارات SaaS

## المرجع الحاكم

- خطة التنفيذ: `teacher-saas-implementation-plan-ar.md` (الإصدار 2.1).
- المعمارية: `docs/architecture.md`.
- التشغيل: `docs/development.md`.
- القرارات: `docs/decisions/`.

## البنية

```text
apps/web/          React 19 + Vite + TypeScript strict (SPA, تُنشر على Vercel كـ Static)
backend/           ASP.NET Core Web API على .NET 10 (Monolith معياري، يُنشر على Linux VPS خلف Nginx)
docs/              توثيق المعمارية والتشغيل والقرارات
scripts/           سكربتات مساعدة
```

## قواعد إلزامية

- الواجهة لا تتصل بقاعدة البيانات مباشرة أبدًا؛ كل الطلبات عبر `src/data/api-client/`.
- ممنوع Next.js أو Supabase SDK في الواجهة.
- متغيرات `VITE_*` مكشوفة للمتصفح — ممنوع وضع أي Secret فيها.
- لا Secrets في Git؛ استخدم `*.example` فقط.
- لا `Database.Migrate()` تلقائيًا في Production؛ Migrations تُطبق يدويًا أو عبر CI.
- Tailwind CSS 4 + ESLint + Vitest في الواجهة.
- EF Core 10 + Npgsql + PostgreSQL في الباك إند.

## أوامر الجودة

- واجهة: `npm run lint` && `npm run typecheck` && `npm run test` && `npm run build` من `apps/web`.
- باك إند: `dotnet restore` && `dotnet format --verify-no-changes` && `dotnet build` && `dotnet test` من `backend/`.
