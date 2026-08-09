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

## بند Phase 4 — الجلسات ومشغل الطالب

### الجلسات (Teacher — مصادق عليها)

```text
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions                 # إنشاء جلسة — 201
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions                 # قائمة الجلسات
GET    /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}     # تفاصيل + إحصاءات
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/activate   # تفعيل — body {baseVersion}
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/finish     # إنهاء — body {baseVersion}
POST   /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/cancel     # إلغاء — body {baseVersion}
```

قواعد:
- إنشاء الجلسة يقبل `mode: SelfPaced | Live`. جلسة Live تنشئ `LiveSessionState` في `Lobby` داخل نفس الحفظ.
- `JoinCode` (8 أحرف) يُولّد عند الإنشاء ويظهر في التفاصيل — يوزعه المعلم على الطلاب.
- إنشاء الجلسة يتطلب اختبارًا منشورًا (`CurrentPublishedVersionId` غير null) ويثبّت `QuizVersionId` عليها؛ `activate` يغيّر حالة الجلسة دون تبديل النسخة.
- `baseVersion` (xmin) مطلوب لعمليات الحالة — اختلافه → `409 Conflict`.

### واجهة اللاعب (بدون مصادقة — Rate-limited)

```text
GET    /api/v1/player/sessions/{joinCode}                                   # metadata الجلسة (بدون أسئلة)
POST   /api/v1/player/sessions/{joinCode}/join                              # انضمام بالاسم — يعيد participantId + كوكي ضيف
GET    /api/v1/player/sessions/{joinCode}/me                                # استعادة اللاعب من كوكي الضيف فقط
POST   /api/v1/player/sessions/{joinCode}/attempts                          # بدء محاولة — يتطلب كوكي الضيف
GET    /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/current-question  # السؤال الحالي + serverNow + deadlineAt
POST   /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/answers      # إرسال إجابة (Idempotent)
POST   /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/finish       # إنهاء المحاولة
GET    /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/result       # النتيجة بعد الإنهاء
GET    /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/media/{mediaId}   # وسائط سؤال داخل المحاولة
```

`GET /api/v1/player/sessions/{joinCode}/me` يعيد `JoinSessionResponse` بنفس الحقول
المستخدمة بعد `join`:

```json
{
  "participantId": "guid",
  "displayName": "اسم الطالب",
  "attemptId": "guid أو null",
  "attemptStatus": "InProgress أو Finished أو TimedOut أو null"
}
```

يُستخدم الرد لتحديد شاشة الاستعادة دون تخزين الاسم أو حالة الجلسة محليًا:

- **start:** `attemptId: null` و`attemptStatus: null` — يبقى الطالب في شاشة الاستعداد ويبدأ محاولة جديدة عند الطلب.
- **resume:** `attemptId` موجود و`attemptStatus: InProgress` — يستدعي العميل بدء المحاولة idempotently لاستعادة المحاولة الحالية.
- **result:** `attemptId` موجود و`attemptStatus: Finished` أو `TimedOut` — ينتقل العميل إلى جلب النتيجة عبر مسار `result`.

يتطلب المسار كوكي الضيف؛ غيابه أو عدم صلاحيته يعيد `401`، وعدم وجود الجلسة يعيد `404`.

قواعد:
- كل نقاط اللاعب `[AllowAnonymous]` ومحدودة المعدل؛ نقاط المحاولة تتطلب كوكي الضيف (`__Host-tp-guest` في Production، `tp-guest` في Development) — بدونها `401`.
- رمز الضيف: 256-bit عشوائي، يُخزن **هاش SHA-256 فقط**، ويُقارن بمقارنة ثابتة الزمن (ADR 007).
- **الأسئلة تُخلط حتميًا** لكل مشارك عبر `ShuffleSeed` — نفس المشارك يرى نفس الترتيب دائمًا (استئناف آمن بعد F5).
- `PlayerQuestion` DTO آمن: لا `IsCorrect` ولا `acceptedAnswers` — الخيارات بنصها فقط.
- صيغ الإجابات: MC/TF/Listening `{"optionId":"guid"}`، ShortAnswer `{"text":"..."}`، Ordering `{"orderedOptionIds":[...]}`.
- **Idempotency:** إعادة إرسال نفس الإجابة = `200`؛ إرسال إجابة **مختلفة** لنفس السؤال = `409 AnswerConflict`. المقارنة دلالية (jsonb يطبّع المخزن — ADR 008).
- **الوقت خادمي:** `serverNow` في كل استجابة؛ بعد `deadlineAt` يُنهي الخادم المحاولة `TimedOut` عند أول طلب لاحق (settle-on-request).
- التصحيح خادمي بالكامل عبر `AnswerScorer` (ADR 008) — العميل لا يرى الإجابات الصحيحة إلا في `result` بعد الإنهاء.

### المسابقة المباشرة (Phase 6)

Teacher endpoints التالية مصادق عليها وتتطلب سياسة إدارة محتوى المستأجر:

```text
GET  /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/live
POST /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/live/token
POST /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/live/questions/open-next
POST /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/live/questions/close
POST /api/v1/tenants/{tenantId}/quizzes/{quizId}/sessions/{sessionId}/live/finish
```

- أوامر `open-next`, `close`, و`finish` تقبل `{ "baseRevision": number, "durationSeconds": number? }`. `durationSeconds` مستخدم عند الفتح فقط ومداه 5..300؛ Revision قديم أو انتقال غير صالح يعيد `409`.
- `token` يعيد `{ accessToken, expiresAt }` لاتصال SignalR قصير العمر ومقيّد بالمستأجر والجلسة ودور المعلم.

Player endpoints تتطلب Guest Cookie الصالح وملكية المشارك للجلسة:

```text
GET  /api/v1/player/sessions/{joinCode}/live
POST /api/v1/player/sessions/{joinCode}/live/token
```

`LiveSessionStateResponse` هو `{ sessionId, sessionStatus, phase, currentQuestionIndex, totalQuestions, questionStartedAt, questionClosesAt, serverNow, revision, participantCount, attemptCount, answeredCount, currentQuestion, leaderboard }`. `currentQuestion` عند وجوده هو `{ quizVersionItemId, index, totalQuestions, questionType, prompt, points, mediaAssetId, options[] }`، والخيار `{ optionId, optionText }`. لا توجد أعلام صحة أو إعدادات تصحيح في هذا العقد. عنصر `leaderboard` هو `{ rank, displayName, score, answeredCount }`.

- Hub الإشعارات: `/hubs/quiz`. الأحداث الحالية: `LobbyUpdated`, `SessionStarted`, `QuestionOpened`, `QuestionClosed`, `LeaderboardUpdated`, `SessionFinished`, و`LiveStateChanged` عند الاتصال.
- لا توجد Hub methods للإجابات أو التحكم ولا يمرر العميل اسم group؛ الخادم يشتق group بعد إعادة تحقق الهوية. الإجابات تظل عبر endpoint Phase 4.
- أثناء `QuestionOpen` يعيد `SubmitAnswerResponse` الحقلين `isCorrect` و`scoreAwarded` كـ`null`، ولا تشمل لوحة الترتيب السؤال المفتوح. بعد الإغلاق يدخل السؤال في الترتيب، وعند `finish` يثبت الخادم النتائج النهائية ثم يستطيع اللاعب جلب `result`.

## بند Phase 5 — التقارير والاستبانة والشهادات

### التقارير (Teacher — مصادق عليها)

```text
GET /api/v1/tenants/{tenantId}/sessions/{sessionId}/report
GET /api/v1/tenants/{tenantId}/sessions/{sessionId}/attempts?page=&pageSize=
GET /api/v1/tenants/{tenantId}/attempts/{attemptId}
GET /api/v1/tenants/{tenantId}/sessions/{sessionId}/report/export.csv
```

- تقرير الجلسة يعيد `sessionId`, `quizId`, `quizTitle`, `sessionLabel`, `sessionStatus`, `activatedAt`, `finishedAt`، ثم `summary` و`questions`.
- `summary` يحتوي `participantCount`, `attemptCount`, `completedCount`, `inProgressCount`, `timedOutCount`, `passedCount`, `failedCount`, `averagePercentage`, `averageDurationMs`.
- تحليل كل سؤال يحتوي المعرّفات والترتيب والنص والنوع والنقاط، وأعداد الإجابات الصحيحة/الخاطئة، ونسبتي النجاح ومتوسط الدرجة، و`difficultySignal` (`InsufficientData | LowDifficulty | ModerateDifficulty | HighDifficulty`).
- قائمة المحاولات تستخدم `PagedResponse`; تفاصيل المحاولة تضيف `questions[]` بالحقول `answered`, `answerSummary`, `isCorrect`, `scoreAwarded`, `answeredAt`.
- CSV مشتق من المحاولات الفعلية، UTF-8 مع BOM، ومحدود المعدل. الخادم يحيد القيم التي قد تبدأ Spreadsheet Formula بدل تمريرها كصيغة قابلة للتنفيذ.

### الاستبانات

```text
GET  /api/v1/tenants/{tenantId}/surveys?quizId=
POST /api/v1/tenants/{tenantId}/surveys
GET  /api/v1/tenants/{tenantId}/surveys/{surveyId}
PUT  /api/v1/tenants/{tenantId}/surveys/{surveyId}
POST /api/v1/tenants/{tenantId}/surveys/{surveyId}/publish

GET  /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/survey
POST /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/survey
```

- يوجد Survey واحد كحد أقصى لكل Quiz. الإنشاء يقبل `quizId`, `title`, `description`, و`questions` من 1 إلى 50.
- نوع السؤال واحد من `Rating`, `SingleChoice`, `ShortText`. سؤال `SingleChoice` يحتاج 2..20 خيارات مميزة، والأنواع الأخرى لا تقبل خيارات.
- تعديل المسودة يتطلب `baseVersion`; اختلاف `xmin` يعيد `409 Conflict`. النشر Idempotent، وبعده يعيد التعديل `409 SurveyPublished`.
- نقطتا اللاعب تتطلبان Guest Cookie ومحاولة مكتملة يملكها الطالب. لا يظهر إلا Survey منشور للاختبار نفسه.
- جسم الإرسال: `answers[]` بعناصر `{ questionId, ratingValue, optionId, text }`; يجب أن يطابق كل عنصر نوع السؤال وتُجاب كل الأسئلة المطلوبة. الإرسال الناجح `201` ويعيد `{ responseId, submittedAt }`، والتكرار يعيد `409 SurveyAlreadySubmitted`.

### الشهادات ومشاركة ولي الأمر

```text
GET  /api/v1/tenants/{tenantId}/certificate-templates
POST /api/v1/tenants/{tenantId}/certificate-templates
PUT  /api/v1/tenants/{tenantId}/certificate-templates/{templateId}

GET  /api/v1/tenants/{tenantId}/certificates
GET  /api/v1/tenants/{tenantId}/certificates/{certificateId}/file
POST /api/v1/tenants/{tenantId}/certificates/{certificateId}/retry

POST /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/certificate
GET  /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/certificate/file
POST /api/v1/player/sessions/{joinCode}/attempts/{attemptId}/parent-share
GET  /api/v1/player/certificates/{publicToken}
GET  /api/v1/public/results/{publicToken}
```

- قالب الشهادة يقبل `name`, `titleText`, `bodyText`, `issuerName`, لوني Hex بصيغة `#RRGGBB`, و`isDefault`. تحديثه يتطلب `baseVersion`; يوجد قالب افتراضي واحد لكل Tenant.
- إصدار اللاعب Idempotent ومتاح فقط لمحاولة مكتملة ناجحة؛ الرسوب يعيد `403 CertificateNotEligible`. الرد `PlayerCertificateResponse` هو `{ certificateId, certificateNumber, status, issuedAt, downloadUrl, publicUrl }`؛ الحالة `Pending | Ready | Failed`. يعيد الإصدار `200` عندما تكون جاهزة و`202` فيما عدا ذلك.
- تنزيل ملف غير جاهز يعيد `409 CertificateNotReady`. يستطيع المعلم إعادة الشهادة الفاشلة إلى `Pending` عبر `retry`.
- `parent-share` يعيد `201` مع `{ shareUrl, expiresAt }`. النتيجة العامة تقتصر على `{ studentName, quizTitle, score, maxScore, percentage, passed, finishedAt, reviewAreas, certificateUrl }`; الرمز المنتهي أو غير الصحيح يعيد `404`.
- ملف الشهادة العام والنتيجة العامة لا يحتاجان JWT. كل نقاط الإصدار/التنزيل الخاصة بالطالب تتحقق من Guest Cookie وملكية المحاولة، ولا تعتمد على `attemptId` وحده.

## الاستجابات الشائعة

- `400`: مدخلات غير صالحة أو سؤال يفشل بقعة Validation (Codes مثل `QuestionInvalid`, `UnsupportedMediaType`, `EmptyFile`).
- `401/403`: غير مصادق / ليس عضوًا / دور غير كافٍ.
- `404`: سؤال/بنك/وسيط/اختبار غير موجود في هذا Tenant.
- `409 Conflict`: تعديل بـ`BaseVersion` قديم؛ `AnswerConflict` لإجابة مختلفة لنفس السؤال؛ `SessionNotActive`/`AttemptFinished` لعمليات على جلسة/محاولة غير نشطة.
- `413 Payload Too Large`: ملف يتجاوز `ImageMaxBytes`/`AudioMaxBytes`.
- `429`: تجاوز معدل الطلبات على نقاط اللاعب.

### رفض حمولة الإجابة

- **`InvalidAnswerPayload`:** إذا كانت `AnswerJson` غير صالحة بنيويًا للسؤال المثبت، يعيد الخادم `400` بعنوان الخطأ `InvalidAnswerPayload`.
- يحدث الرفض قبل حفظ `AttemptAnswer` أو حساب الدرجة؛ لذلك لا تُحفظ الإجابة، ولا تحصل على Score، ولا يتقدم الطالب إلى السؤال التالي.

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
