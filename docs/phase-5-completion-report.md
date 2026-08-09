# Phase 5 — Delivery Flows — تقرير الإغلاق

**التاريخ:** 2026-08-09  
**الفرع:** `goal/client-delivery`  
**Base SHA:** `8a4e5ecf185d2bf82d4a804ad558a65ee99025ee` — نقطة البداية بعد جولة التوفيق السابقة لـPhase 5.

## النطاق المنفذ

- تقارير الجلسات والمحاولات Tenant-scoped، مع تفاصيل الإجابات وتصدير CSV آمن من CSV formula injection.
- استبانة واحدة لكل اختبار: Draft قابلة للتعديل بـ`xmin` ثم Published غير قابلة للتعديل، وتدعم Rating وSingleChoice وShortText.
- إصدار شهادة فقط لمحاولة مكتملة وناجحة وفق `Attempt.Passed` الخادمي، مع قالب افتراضي وقوالب قابلة للإدارة.
- توليد PDF عربي عبر QuestPDF في Outbox transaction، ومعالجة idempotent بقفل وretry/backoff ومفتاح تخزين حتمي.
- رابط شهادة عام ورابط نتيجة مستقل لولي الأمر من DTO محدود، مع تخزين hashes فقط للبحث وعدم تخزين raw parent token.
- واجهات المعلم والطالب والمسارات العامة المطلوبة، وE2E حقيقي للمسار الناجح والراسب.

## تغييرات قاعدة البيانات

1. `20260809175242_CreateSurveys`
2. `20260809185405_CreateCertificatesAndOutbox`

طُبقت المهاجرتان على قاعدة PostgreSQL المخصصة لـE2E قبل تشغيل سيناريو المتصفح. لا يوجد `Database.Migrate()` تلقائي في Production.

## التحقق المنفذ

| الفحص | النتيجة |
|------|---------|
| `dotnet format --verify-no-changes` | ناجح |
| `dotnet build` | 0 خطأ، 0 تحذير |
| اختبارات Backend | Domain 62 + API 1 + Integration 113 = **176/176** |
| `npm run lint` / `npm run typecheck` / `npm run build` | ناجحة |
| اختبارات Frontend | **90/90** في 21 ملفًا |
| Playwright على منافذ معزولة 5100/5273 | Part A **1/1** + Part B **2/2** |
| فحص PDF فعلي بعد render | العربية متصلة، ولا قص أو تداخل |

يشمل Part B: نجاح 10/10، انتظار وتنزيل PDF صالح، استبانة من ستة أسئلة، مشاركة نتيجة ولي الأمر، استعادة النتيجة بعد F5، تقرير المعلم وCSV، ثم محاولة راسبة معزولة 0/10 بلا شهادة.

## القيود المسجلة عند الإغلاق

- Outbox worker يعمل داخل عملية الـAPI في هذه المرحلة؛ يحتاج التشغيل الإنتاجي مراقبة مناسبة وعدم تشغيل workers متنافسة دون مراجعة استراتيجية المعالجة.
- `Storage:Provider=S3` ما زال fail-fast وغير منفذ؛ يجب توصيل SDK وSecret store واختبار التخزين قبل أي نشر Production يعتمد S3.
- اختيار ترخيص QuestPDF مسؤولية تشغيلية/قانونية خارج المستودع؛ Production يرفض البدء إن لم تُضبط `Certificates:QuestPdfLicense` صراحةً.
- تشغيل Linux يتطلب عائلة خط متاحة؛ الإعداد الافتراضي `DejaVu Sans`.
- Phase 6 لم تبدأ ضمن هذا التقرير.

## Commits التاريخية للتنفيذ

- `816be5be77f1d75db17452b5c7f7cac1cf4f5186` — `feat(reports): add session and attempt reporting`
- `bd3ab0f3e9e901dff2534159bb8ea51c7cc75282` — `feat(surveys): add survey builder and submissions`
- `8af413f163b3369853e2c0199528c12f2cbbaf1c` — `feat(certificates): add certificates and parent sharing`
- `87c6990d35ba7068a127d54d72dfb4bd351de279` — `test(e2e): cover phase 5 delivery flows`

تغييرات وثائق الإغلاق تأتي في commit لاحق حتى لا يصبح هذا التقرير self-referential. لمعرفة Current repository HEAD استخدم `git rev-parse HEAD`؛ لا يمثل أي SHA ثابت داخل هذا التقرير الحالة الحالية إلى الأبد.
