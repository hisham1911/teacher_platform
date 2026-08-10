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
- حدود الاستخدام: `QuizLimits` (`MaxQuizzesPerTenant` افتراضيًا 100، `MaxQuestionsPerQuiz` افتراضيًا 200، و`MaxPublishedQuizzesPerTenant` افتراضيًا 50) عبر IQuizLimitService؛ التجاوز → 403 `QuotaExceeded`.
- المشاركة: `GET .../quizzes/{id}/share` يعيد PublicCode + ShareUrl؛ صفحة النشر تعرض الرابط + QR Code (react-qr-code).

## الحالة الحالية (بعد Phase 8)

- **Phase 4:** Student Player / Sessions / Server-side scoring.
- **Phase 4.1:** Answer payload validation + real-browser hardening.
- استعادة اللاعب بعد F5 أصبحت Server-side عبر `GET /api/v1/player/sessions/{joinCode}/me`.
- Player لا يعتمد على `localStorage` لاستعادة `DisplayName` أو حالة الجلسة؛ Guest session تعتمد على HttpOnly Guest Cookie.
- **Phase 5:** تقارير الجلسات والمحاولات وتحليلات الأسئلة وتصدير CSV، منشئ استبانة وإرسالها، وشهادات PDF للناجحين فقط.
- إصدار الشهادة Idempotent ويجري عبر `OutboxMessages` و`OutboxWorker`؛ الفشل قابل لإعادة المحاولة من شاشة `/dashboard/certificates`.
- مشاركة ولي الأمر تستخدم رابط نتيجة محدودًا ومؤقتًا؛ الشهادة العامة تستخدم رمزًا عشوائيًا ولا تكشف إجابات طالب آخر.
- Playwright E2E harness داخل `e2e/` يغطي الاستعادة بعد F5، التقرير/CSV، الاستبانة، شهادة النجاح، وعدم إصدارها عند الرسوب.
- **Phase 6:** مسابقات Live بحالة خادمية في PostgreSQL، Host controls وtimer ولوحة ترتيب، وإشعارات SignalR عبر `/hubs/quiz` مع polling fallback.
- إجابات Live تبقى REST وتُصحح خادميًا؛ لا يرى اللاعب الصحة أو الدرجة قبل إغلاق السؤال، ولا يختار العميل SignalR groups.
- Playwright يغطي Host + Player في سياقين، إخفاء التصحيح حتى الإغلاق، والنتيجة بعد F5.
- **Phase 7:** خطط واشتراكات وتفعيل يدوي واستخدام وتدقيق عبر دور عالمي `PlatformAdmin` وصفحة `/platform`؛ الحدود الفعلية تُفرض خادميًا من الخطة النشطة مع fallback للإعدادات.
- تصدير/استيراد محتوى المستأجر متاح للـOwner فقط كـZIP بإصدار format وفحوص checksums وdry-run؛ لا ينقل الحسابات أو المحاولات أو الاشتراكات أو الأسرار.
- محولا S3-compatible وSMTP منفذان ويُفعّلان من Configuration؛ أمثلة Nginx/systemd وPipeline النشر والنسخ الاحتياطي المشفر والاستعادة تحت `ops/` و`scripts/`.
- **Phase 8:** اكتمل Hardening وجاهزية الـpilot: تشديد كل كتابات المحتوى إلى Owner/Teacher، معالجة سباق حفظ الإجابة الأخيرة مع إنهاء المحاولة، صفحات الخصوصية والشروط و404، Security Headers، وتحديث lockfile بلا ثغرات npm معروفة.
- فحص التشغيل الدوري موجود في `scripts/check-operational-health.sh` مع systemd timer داخل `ops/systemd/`؛ يفحص live/readiness وحداثة النسخة المشفرة وتأخر Outbox.
- المراحل 5–8 مكتملة في فرع التسليم. النشر الفعلي ما زال يتطلب Domain وProduction credentials وخدمات SMTP/S3 وقرار QuestPDF license؛ لا تُخزن أي منها في Git.

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
