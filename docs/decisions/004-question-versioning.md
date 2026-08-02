# ADR 004 — تعدد نسخ الأسئلة: إصدارات غير قابلة للتعديل ولا الحذف

**الحالة:** Accepted  
**التاريخ:** 2026-08-02

## السياق

الاختبارات المنشورة (Phase 3 وما بعدها) يجب أن تعرض للطالب دائمًا نفس السؤال حتى لو عدّل
المعلم المحتوى لاحقًا. لا يُقبل تغيّر Question بعد نشره في Quiz، ولا حذف سجل إجابات سابقة
لأن تاريخه قد يحمل قرارات تصحيح ونتائج.

في الوقت نفسه، لا ينبغي للمعلم الاحتفاظ بنسخ متعاقبة بلا نهاية أو كتابة فوق أخطاء الماضي
كما يحدث عند استخدام PUT على نفس الصف.

## القرار

- `Question` يمثل الهوية: الحالة (Active/Archived)، CurrentVersion، وxmin كـOptimistic Concurrency.
- `QuestionVersion` Immutable: VersionNumber تزايدي، Prompt/Explanation/ConfigJson/الوسائط/Options محفوظة وقت الإنشاء.
- أي تعديل للمحتوى = `POST /versions` مع `BaseVersion` من آخر قراءة (xmin).
- Conflict اليبالغ: لو BaseVersion مختلف عمّا في DB → 409، دون تحديث أي شيء.
- Archive يغيّر Status فقط؛ لا DELETE فيزيائي ولا إزالة للوسائط.
- `QuestionValidator` خالص في Domain ويُعاد استخدامه في Phase 3 لتحديد صلاحية النشر.
- الوسائط المرتبطة بأي نسخة تاريخية لا تُحذف أبدًا (نلتزم بسياسة الأرشيف).

## البدائل

- **تحديث حرفي على نفس الصف:** يكسر أي Attempt سابق ويجعل التقارير غير موثوقة.
- **Soft Delete مع Overwrite:** لا يكفل الثبات؛ مسار الإصدار يغطي المشكلة بشكل مباشر.
- **JSONB كامل للنسخة:** كنا سنفقد فهارس البحث/تناسق Options وتكرارها.

## النتائج

- `QuizVersionItem` في Phase 3 سيتمكن من الإشارة لـQuestionVersionId بأمان Immutable.
- العدد `Question.Version` (xmin) يتحقق من Client-supplied baseVersion عبر EF Core
  `DbUpdateConcurrencyException` عند التسابق، مع Predicate مسبق سريع للرد 409.

## قيود

- لا يوجد Merge للإصدارات؛ النسخ تقرؤها Interface بصورة Timeline (الأحدث فوق).
- النسخ المعطلة (Invalid) تبقى محفوظة؛ Preview يعرض "غير صالح" ولا يمكن نشرها لاحقًا إلا عبر Validation جديد.
