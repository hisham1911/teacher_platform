# ADR 006 — حدود الاستخدام: سقف الاختبارات والأسئلة لكل Tenant

**الحالة:** Accepted  
**التاريخ:** 2026-08-03

## السياق

المنصة متعددة المستأجرين (SaaS). تحتاج كل مساحة عمل إلى حدود خادمية تمنع استهلاك الموارد المشتركة، مع عزل العدّ بين المستأجرين وفشل مغلق عند غياب سياق المستأجر.

## القرار

- **التجريد:** `IQuizLimitService` في Application، ويعيد `ServiceResultException` برمز `QuotaExceeded` عند تجاوز الحد، أو `null` عند السماح.
- **العمليات:** `CheckCanCreateQuizAsync(Guid tenantId, CancellationToken ct)`, و`CheckCanAddQuestionAsync(Guid tenantId, Guid quizVersionId, CancellationToken ct)`, و`CheckCanPublishAsync(Guid tenantId, Guid quizId, CancellationToken ct)`؛ كل عملية تستقبل `tenantId` صريحًا.
- **التنفيذ:** `QuizLimitService` في Infrastructure يعدّ من `AppDbContext` بعد تحقق صريح من `TenantId` وتحت Global Query Filters.
- **الإعداد:** قسم `QuizLimits` في الإعدادات: `MaxQuizzesPerTenant` (افتراضي **100**)، `MaxQuestionsPerQuiz` (افتراضي **200**)، و`MaxPublishedQuizzesPerTenant` (افتراضي **50**).
- **نقطة الفرض:** عند إنشاء الاختبار، وإضافة سؤال إلى المسودة، ونشر اختبار جديد؛ إعادة نشر اختبار منشور لا تستهلك حصة نشر إضافية. الأرشفة تستبعد الاختبار من العدّ المناسب.
- **الاستجابة:** `GlobalExceptionHandler` يحوّل `QuotaExceeded` إلى `403` مع `problem+json`.

## السلوك الحالي

- `QuizService` يستخرج `TenantId` الحقيقي من `ITenantContext` عبر `RequireTenantId()`، ويمرره إلى جميع فحوص `QuizLimitService`.
- `QuizLimitService` يرفض قبل العدّ إذا كان `tenantId` فارغًا، أو كان `TenantContext` غير محلول، أو لم يطابق المعرف المحلول (`TenantContextMismatch`). لذلك لا يعتمد حدّ مستأجر على `Guid.Empty` ولا يمكنه العدّ عبر مستأجر آخر.
- العدّ الحالي مستأجر-scoped: الاختبارات غير المؤرشفة، والأسئلة داخل مسودة محددة، والاختبارات المنشورة تُحسب ضمن المستأجر المحلول.

## البدائل

- **الفرض عند النشر فقط:** يسمح بتراكم مسودات غير محدودة ثم يفاجئ المستخدم عند النشر — تجربة أسوأ.
- **حد ثابت داخل الكود:** يتطلب إعادة نشر لتغييره — مرفوض لصالح الإعداد.
- **جدول Quotas لكل Tenant:** مرونة أعلى، لكنه YAGNI حاليًا؛ التجريد الحالي يسمح بتبديل التنفيذ لاحقًا.
- **الاعتماد على Global Query Filters وحدها:** لا يكفي لحماية فحص حدود الاستخدام؛ لذلك يوجد تحقق صريح من السياق وشرط `TenantId`.

## المشكلة التاريخية — مغلقة

في مراجعة Phase 3 كان `QuizService` يمرر `Guid.Empty` لبعض فحوص الحد، وكان ذلك موثقًا كـGAP-D / smell مؤقت. أُغلق هذا في commit `5b60ecd`؛ الوصف الحالي أعلاه هو السلوك المعتمد، ولا ينبغي اعتبار `Guid.Empty` قيدًا قائمًا.

## القيود الحالية

- القيم الحالية عامة على مستوى كل Tenant ولا تدعم بعد تخصيص خطة مختلفة لكل مستأجر.
- العدّ يشمل كل ما ليس `Archived` في حد الاختبارات، لذلك المسودة المنسية تستهلك السعة.
