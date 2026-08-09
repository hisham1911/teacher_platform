# ADR-011 — إدارة SaaS ونقل المحتوى وتشغيل الإنتاج

**الحالة:** Accepted  
**التاريخ:** 2026-08-10

## السياق

بعد اكتمال التدفقات التعليمية وLive، تحتاج النسخة التجريبية إلى تفعيل خطط يدوي، حدود خادمية، رؤية استخدام، سجل تدقيق، نقل محتوى آمن، ومحولات وتشغيل Production قابلة للتحقق. Payment gateway وmulti-node deployment ليسا ضمن Phase 7.

## القرار

1. `PlatformAdmin` دور ASP.NET Identity عالمي مستقل عن أدوار المستأجر، ويُمنح فقط بعملية تشغيل موثقة. كل `/api/v1/platform/*` محمي بسياسة خادمية تتطلب هذا الدور.
2. تحفظ الخطة الحدود الستة في `Plans.LimitsJson`. يسمح `Subscriptions` باشتراك نشط واحد لكل مستأجر، والتفعيل يدوي ويلغي السابق داخل transaction. عند غياب خطة نشطة تستخدم الحدود الافتراضية الحالية.
3. quotas تُفرض عند نقطة الكتابة على الخادم. `UsageCounters` لقطة للإدارة وليست مصدر قرار السماح؛ الحساب الفعلي يأتي من الجداول الأصلية.
4. `AuditLogs` سجل platform-scoped ذو `TenantId` اختياري. الـmetadata محدود بمعرّفات وكود الخطة وcounts؛ لا يسجل كلمات مرور أو tokens.
5. نقل المحتوى Owner-only يستخدم ZIP format version 1 مع manifest وSHA-256. الاستيراد يبدأ بـdry-run، لا يثق في TenantId المصدر، يعيد تعيين المعرّفات، يفحص مراجع JSON وMagic bytes والحدود، ويعوض uploads عند فشل transaction.
6. Production يستخدم `SmtpEmailSender` مع TLS و`S3ObjectStorage` عبر AWS SDK. Development/E2E يبقيان على File mail وLocal storage.
7. النشر الحالي single-node خلف Nginx/systemd. كل نشر يسبقه backup PostgreSQL مشفر، ثم EF migration bundle، ثم تبديل release symlink وفحوص health. rollback يعيد التطبيق السابق فقط؛ rollback قاعدة البيانات ليس تلقائيًا.

## النتائج

- لا يستطيع Client تجاوز حدود الخطة أو منح PlatformAdmin لنفسه.
- الإدارة اليدوية تكفي للـpilot دون إدخال Payment Provider قبل الحاجة.
- ZIP قابل للنقل بين مستأجرين ولا يحمل بيانات هوية أو نتائج، لكنه ليس نسخة disaster recovery كاملة.
- استعادة PostgreSQL تحتاج أيضًا مزامنة Object Storage ومفاتيح Data Protection لاستعادة النظام كاملًا.
- scale-out وRedis backplane وbilling automation خارج هذا القرار.
