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

## Phase 2 (بنك الأسئلة والوسائط)

- جداول جديدة: MediaAssets, QuestionBanks, Questions, QuestionVersions, QuestionOptions, QuestionTags, QuestionTagLinks.
- تجريد IObjectStorage مع تنفيذ Local للتطوير/الاختبارات (مساحة `.media-storage/` مستبعدة) وS3-compatible fail-fast للإنتاج.
- رفع الوسائط عبر `/api/v1/tenants/{id}/media` مع فحص Magic bytes والحجم (5MB صور، 20MB صوت في البيئة الافتراضية).
- الأسئلة تعتمد تعدد نسخ Immutable (الإصدار رقم 1 عند الإنشاء، وأي تعديل = نسخة جديدة، وBaseVersion mismatch → 409).

## Phase 3 (Quiz Builder والنشر)

- جداول جديدة: Quizzes, QuizVersions, QuizVersionItems. الاختبار = هوية + مؤشرات (CurrentDraft/CurrentPublished)؛ المحتوى في QuizVersion Immutable، وQuizVersionItem يثبّت QuestionVersionId.
- النشر يتطلب IsValid على المسودة وينقل المؤشر ذرّيًا؛ BaseVersion (xmin) mismatch → 409.
- الوصول العام: `GET /api/v1/public/quizzes/{publicCode}` بدون مصادقة — metadata فقط (لا أسئلة/خيارات/إجابات). صفحة الهبوط: `/q/:publicCode` خارج RequireAuth.
- حد الاختبارات النشطة: `Quiz:MaxActivePerTenant` (افتراضي 50) عبر IQuizLimitService؛ التجاوز → 403 QuizLimitExceeded.
- المشاركة: `GET .../quizzes/{id}/share` يعيد PublicCode + ShareUrl؛ صفحة النشر تعرض الرابط + QR Code (react-qr-code).

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
