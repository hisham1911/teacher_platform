# Phase 6 — Live Competition / SignalR — تقرير الإغلاق

**الفرع:** `goal/client-delivery`  
**Base SHA:** `68992a4ad23d4026b6cb13211b137ab599e2d1f3` — نقطة الإغلاق الموثقة بعد Phase 5.

## ما أُنجز

- جلسات `Live` بحالة خادمية في `LiveSessionStates` وانتقالات Lobby/Open/Closed/Finished محمية بـRevision و`xmin`.
- Host controls للسؤال والمدة والإنهاء، timer خادمي وworker للإغلاق المنتهي، وإنهاء خادمي لكل المحاولات الجارية.
- Hub `/hubs/quiz` للإشعارات فقط، groups مشتقة في الخادم، وJWTs قصيرة العمر للمعلم واللاعب مع إعادة تحقق قاعدة البيانات.
- Player مباشر يستعيد هويته من HttpOnly Guest Cookie، يرسل الإجابات عبر REST، ولا يرى الصحة أو الدرجة قبل الإغلاق.
- لوحة Host وPlayer مع إعادة اتصال تلقائية وpolling fallback، ولوحة ترتيب مشتقة من الأسئلة المغلقة فقط.
- Migration `20260809201234_CreateLiveCompetition` وتغطية PostgreSQL/SignalR لـ30 مشاركًا وعزل الجلسات.

## التحقق عند الإغلاق

- Backend: `dotnet format --verify-no-changes`، Build بلا تحذيرات، Domain 62/62، API 1/1، Integration 116/116.
- Frontend: ESLint وTypeScript وBuild نجحت؛ Vitest ‏92/92.
- Playwright Chromium: Part A ‏1/1، Part B ‏2/2، Live Part C ‏1/1. Part C يثبت Host + Player، حجب feedback حتى الإغلاق، leaderboard، والنتيجة بعد F5.
- طُبقت Migration Phase 6 على قاعدة E2E يدويًا قبل الفحص؛ لا يوجد `Database.Migrate()` تلقائي في Production.

## حدود القرار الحالي

- النشر Live single-node بلا Redis backplane؛ scale-out خارج نطاق Phase 6 وموثق في ADR 010.
- لا تُرسل الإجابات عبر Hub، ولا يختار العميل groups. هذا قرار أمني مقصود لا نقصًا.

## Commits المسجلة تاريخيًا

- `ebb1b07f6846618429a9a60bab2c079799566897` — `feat(live): add server-authoritative competitions`
- `5f767254b109639358c6959639cad9a078ffe093` — `feat(web): deliver live host and player experience`

Commit التوثيق الذي يحتوي هذا التقرير يأتي لاحقًا، لذلك لا يسجل التقرير قيمة ثابتة بوصفها Current HEAD. للحصول على الرأس الحالي استخدم `git rev-parse HEAD` و`git status --short`.

Phase 7 لم تبدأ ضمن هذا التقرير.
