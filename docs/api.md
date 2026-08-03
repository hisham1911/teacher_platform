# توثيق واجهة البرمجة (API)

Base path: `/api/v1` — كل الطلبات ترجع `ProblemDetails` للأخطاء وتستخدم JSON meshed بالـOpenAPI.

المصادقة:
- `POST /api/v1/auth/register`, `login`, `refresh`, `logout`, `confirm-email`, `forgot-password`, `reset-password` (موجودة من Phase 1).
- `Access Token` Bearer يحفظ في ذاكرة المتصفح فقط. `Refresh Token` في `__Host-tp-refresh` HttpOnly (أو `tp-refresh` في Development عندما UseSecureCookie=false).
- متغيرات Workspace: ترسل `X-Tenant-Id` بنفس معرف الـRoute `{tenantId}` — الغرض اختيار العضوية وليس إثباتها.

## بند Phase 2 — بنوك الأسئلة والوسائط

### بنوك الأسئلة

```text
GET    /api/v1/tenants/{tenantId}/question-banks
POST   /api/v1/tenants/{tenantId}/question-banks       # Owner/Teacher فقط
PATCH  /api/v1/tenants/{tenantId}/question-banks/{bankId}
```

استجابة كل بنك: `{ id, name, description, questionCount, createdAt }`.

### الوسوم

```text
GET /api/v1/tenants/{tenantId}/question-tags
```

تُنشأ تلقائيًا مع أول سؤال يستخدم الاسم (Normalized: `lower + trim`).

### الأسئلة

```text
GET    /api/v1/tenants/{tenantId}/questions?bankId=&type=&difficulty=&tag=&search=&includeArchived=&page=&pageSize=
POST   /api/v1/tenants/{tenantId}/questions                # إنشاء v1 في معاملة واحدة — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/questions/{questionId}
GET    /api/v1/tenants/{tenantId}/questions/{questionId}/versions
GET    /api/v1/tenants/{tenantId}/questions/{questionId}/versions/{versionNumber}
POST   /api/v1/tenants/{tenantId}/questions/{questionId}/versions   # تعديل المحتوى = نسخة جديدة — Owner/Teacher
POST   /api/v1/tenants/{tenantId}/questions/{questionId}/archive    # إخفاء بدون حذف — Owner/Teacher
```

قواعد:
- `BaseVersion` (حقول `xmin` المعروضة في `GET /questions/{id}` باسم `version`) مطلوب عند إنشاء نسخة جديدة. اختلافه → `409 Conflict`.
- `Options` تخزن بالترتيب الكمرسل (`SortOrder` = فهرس الصفيف)، ولا تتغير بعد إنشاء النسخة.
- Stale refs: كل FK مُركّب `{ChildId, TenantId}`، مما يمنع Cross-tenant فعليًا حتى عند محاولة تجاوز.

#### أنواع الأسئلة الخمسة

| النوع | الحقول الإضافية | قواعد خاصة |
|-------|----------------|------------|
| `MultipleChoice` | `options` 2..10 | إجابة صحيحة واحدة بالضبط |
| `TrueFalse` | `options` بطول 2 | نفس القاعدة |
| `ShortAnswer` | `acceptedAnswers[]` | بدون `options`؛ تحفظ في `ConfigJson` |
| `Ordering` | `options` 2..10 | ترتيب Array = الإجابة الصحيحة |
| `Listening` | `options` 2..10 + `mediaAssetId` (Kind=Audio) | `mediaAssetId` إلزامي |

### الوسائط

```text
POST /api/v1/tenants/{tenantId}/media                      # multipart/form-data: file — Owner/Teacher/Assistant
GET  /api/v1/tenants/{tenantId}/media/{mediaId}            # بيانات الوصف فقط
GET  /api/v1/tenants/{tenantId}/media/{mediaId}/content    # بث المحتوى
```

- الأنواع المقبولة: JPEG وPNG وWebP (صور)؛ MP3 وWAV وM4A (صوت). **SVG مرفوض دائمًا.**
- الفحص: `Storage:ImageMaxBytes` (افتراضي 5MB) و`Storage:AudioMaxBytes` (افتراضي 20MB)، فحص الامتداد، و**Magic bytes** (لا نثق بـ`Content-Type` ولا باسم الملف).
- الأسماء الداخلية GUID-only: `tenant-assets/{tenantId}/{questions|audio}/{assetId}/original.ext`.
- التخزين كائنات عبر `IObjectStorage`: محلي للتطوير/الاختبارات (`.media-storage/`)، وتجريد S3-compatible للإنتاج. لا تُعاد مسارات الداخل أبدًا.

## بند Phase 3 — Quiz Builder والنشر

### الاختبارات (Quizzes)

```text
GET    /api/v1/tenants/{tenantId}/quizzes?search=&status=&page=&pageSize=
POST   /api/v1/tenants/{tenantId}/quizzes                          # إنشاء مسودة — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}
PATCH  /api/v1/tenants/{tenantId}/quizzes/{quizId}                 # تعديل بيانات الاختبار — BaseVersion مطلوب
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/archive         # أرشفة — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft           # المسودة الحالية مع العناصر
PUT    /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft           # تعديل المسودة — BaseVersion مطلوب
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items     # إضافة سؤال — Owner/Teacher
PATCH  /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}   # تعديل عنصر (النقاط) — Owner/Teacher
DELETE /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/{itemId}   # إزالة سؤال — Owner/Teacher
PUT    /api/v1/tenants/{tenantId}/quizzes/{quizId}/draft/items/order      # إعادة ترتيب — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/preview         # معاينة النسخة المنشورة
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/versions        # سجل النسخ
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/versions/{versionNumber}  # نسخة محددة
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/publish         # نشر المسودة — Owner/Teacher
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/share           # رابط المشاركة + PublicCode
```

قواعد:
- `BaseVersion` (حقول `xmin` المعروضة في `GET /quizzes/{id}` باسم `version`) مطلوب عند التعديل. اختلافه → `409 Conflict`.
- `QuizVersionItem` يثبّت `QuestionVersionId` — لا يتغير بعد إنشاء النسخة.
- النشر يتطلب `IsValid` على المسودة: كل سؤال Active وله `CurrentVersionId` صالح في نفس الـTenant.
- `PublicCode` يُولّد تلقائيًا عند الإنشاء (GUID-only، 32 حرفًا) ويُستخدم للوصول العام.

### الاختبارات العامة (Public Quizzes)

```text
GET    /api/v1/public/quizzes/{publicCode}                   # بدون مصادقة — metadata فقط
```

- يعيد `available: false` إذا كان الاختبار `Draft` أو `Archived` أو غير موجود.
- **Metadata فقط** — لا أسئلة ولا خيارات ولا إجابات ولا درجات ولا تفاصيل مستأجر. الأسئلة تُسلَّم فقط عند بدء المحاولة (Phase 4).
- شكل الاستجابة (`PublicQuizPageResponse`):

```json
{
  "title": "اختبار الوحدة الأولى",
  "description": "وصف اختياري",
  "instructions": "تعليمات اختيارية",
  "passingPercentage": 60,
  "timeMode": "NoLimit | TotalTime | PerQuestion",
  "timeLimitSeconds": null,
  "questionCount": 5,
  "totalPoints": 50,
  "theme": {
    "template": "default",
    "primaryColor": "#2563eb",
    "secondaryColor": "#7c3aed",
    "backgroundColor": "#ffffff"
  },
  "available": true
}
```

- صفحة الهبوط العامة في الواجهة: `/q/{publicCode}` (بدون مصادقة) تعرض هذه البيانات فقط.

## الاستجابات الشائعة

- `400`: مدخلات غير صالحة أو سؤال يفشل بقعة Validation (Codes مثل `QuestionInvalid`, `UnsupportedMediaType`, `EmptyFile`).
- `401/403`: غير مصادق / ليس عضوًا / دور غير كافٍ.
- `404`: سؤال/بنك/وسيط/اختبار غير موجود في هذا Tenant.
- `409 Conflict`: تعديل بـ`BaseVersion` قديم.
- `413 Payload Too Large`: ملف يتجاوز `ImageMaxBytes`/`AudioMaxBytes`.

## Pagination

كل نقطة تختار قائمة تستخدم `PagedResponse<T>`:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

`pageSize` بين 1 و100؛ أي شيء أعلى يتحول تلقائيًا إلى 100.
