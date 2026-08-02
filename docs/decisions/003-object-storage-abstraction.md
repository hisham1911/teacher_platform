# ADR 003 — تجريد Object Storage: محلي للتطوير، S3 متوافق للإنتاج

**الحالة:** Accepted  
**التاريخ:** 2026-08-02

## السياق

يحتاج بنك الأسئلة إلى رفع صور ومقاطع صوتية. لا يجوز تخزين Binaries في PostgreSQL،
ولا عرض مسار التخزين الداخلي للواجهة، ولا وضع مفاتيح AWS في `VITE_*`.

نريد بيئة تطوير تعمل بلا Docker ولا حساب Cloud، مع مسار إنتاج يتبع S3-compatible
عند الحاجة دون إعادة كتابة Use Cases.

## القرار

- أنشئ واجهة `IObjectStorage` في `Application` بأربع عمليات فقط:
  `UploadAsync / OpenReadAsync / DeleteAsync / ExistsAsync`.
- Local storage: تنفيذ Development/Testing يكتب تحت `.media-storage/` داخل Content root.
  الجذر مستبعد من Git. لا يعرض أي بيانات مباشرة للملفات؛ القراءة عبر API endpoint
  بعد تحقق Middleware من عضوية المستأجر.
- S3-compatible: تنفيذ علاوة في `Infrastructure` مع fail-fast واضح في Production حتى
  يتوفر AWSSDK.S3 — لا نصنع نصف تنفيذ صامت يفشل في وقت متأخر.
- MediaAsset يحمل `ObjectKey` فقط. MIME/Size/Kind/OriginalFileName تُخزن
  للتحقق ولواجهة العرض. لا Signed URLs مخزنة.

## البدائل

- **Base64 داخل PostgreSQL:** مرفوض؛ ضياع مساحة، بطء، وكسر لقاعدة "لا Binary في قاعدة البيانات".
- **Cloudinary / روابط عامة:** تسرّب TenantId واسم الملف، ولا تلامس النطاق الأمني للواجهة كما يجب.
- **Docker MinIO فورًا في NOW:** جيد، لكن Phase 2 التُزمت بلا Docker إلزامي ولم يكن متوفرًا أمام جهاز العمل الحالي.

## النتائج

- Tenant isolation: كل ObjectKey يحمل `tenant-assets/{tenantId}/...`، والـSave Guard
  يمنع كتابة/قراءة بيانات خارج المستأجر الحالي.
- Local storage قابل للاختبار حقيقيًا في CI عبر مسار مؤقت مُهيأ من `TestWebApplicationFactory`.
- تغيير Provider=S3 في المستقبل يستلزم: تثبيت AWSSDK.S3، تفعيل القسم Storage،
  وإلغاء الـfail-fast — لا تغيير في Use Cases.

## قيود معروفة

- لا يوجد Link لتحميل عام غير موثق؛ كل قراءة تمر عبر `GET /api/v1/tenants/{tenantId}/media/{id}/content`
  وتخضع لسياسة `ActiveTenantMember`.
- حذف الملفات يدويّ حاليًا: لا Job لتنظيف Orphans لأن القاعدة تقول الوسائط المستخدمة في نسخ تاريخية لا تُحذف.
  يستنتج Cleanup الحقيقي عند ظهور حجم مخزن كبير أو عند Phase تشغيلية لاحقة.
