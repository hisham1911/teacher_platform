# قاعدة البيانات — حتى Phase 7

التعريفات الإضافية فوق Phase 0/1/2:

## Quizzes

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | GUID من الخادم |
| TenantId | uuid | ITenantEntity — في Global Filter وGuard |
| Title | varchar(200) | |
| Slug | varchar(120) | |
| NormalizedSlug | varchar(120) | unique per (TenantId, NormalizedSlug) |
| Description | varchar(2000) nullable | |
| Status | int | Draft=1, Published=2, Archived=3 |
| CurrentDraftVersionId | uuid nullable | آخر نسخة مسودة |
| CurrentPublishedVersionId | uuid nullable | آخر نسخة منشورة |
| PublicCode | varchar(32) | GUID-only، unique per (TenantId, PublicCode) |
| SubjectId | uuid nullable | FK مركب → `Subjects (Id, TenantId)` NoAction |
| GradeId | uuid nullable | FK مركب → `Grades (Id, TenantId)` NoAction |
| xmin | xid | RowVersion for optimistic concurrency (`Version` property) |
| CreatedAt/UpdatedAt | timestamptz | Guard المركزي |

## QuizVersions (Immutable)

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| QuizId, TenantId | FK مركب → `Quizzes (Id, TenantId)` NoAction | |
| VersionNumber | int | unique per (QuizId, VersionNumber) |
| Status | int | Draft=1, Published=2, Archived=3 |
| TitleSnapshot | varchar(200) | |
| DescriptionSnapshot | varchar(2000) nullable | |
| InstructionsSnapshot | varchar(4000) nullable | |
| PassingPercentage | int | 0..100 |
| TimeMode | int | NoLimit=1, TotalTime=2, PerQuestion=3 |
| TimeLimitSeconds | int nullable | |
| ShuffleQuestions | bool | |
| ShuffleOptions | bool | |
| ThemeJson | jsonb | |
| PublishedAt | timestamptz nullable | |
| Checksum | varchar(64) nullable | SHA-256 للمحتوى |
| xmin | xid | RowVersion for optimistic concurrency |
| CreatedAt/UpdatedAt | timestamptz | |

## QuizVersionItems

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK | |
| TenantId | uuid | مكرر مراعًاة للسلامة المركبة |
| QuizVersionId | uuid | FK مركب → `QuizVersions (Id, TenantId)` NoAction |
| QuestionVersionId | uuid | FK مركب → `QuestionVersions (Id, TenantId)` NoAction |
| SortOrder | int | unique per (QuizVersionId, SortOrder) |
| Points | int | |
| IsRequired | bool | |
| CreatedAt | timestamptz | |

## قواعد Phase 3

- لا Cross-tenant FK: كل FK بين جداول Tenant-owned مركب ويشير لطرفي (Id + TenantId).
- لا Cascade Delete: كل علاقات Phase 3 `DeleteBehavior.NoAction`.
- لا حذف نسخ/عناصر: Archive State فقط.
- QuizVersionItem يثبّت `QuestionVersionId` — لا يتغير بعد إنشاء النسخة.
- النشر يتطلب `IsValid` على المسودة: كل سؤال Active وله CurrentVersionId صالح.

## Phase 4 — الجلسات والمحاولات

### QuizSessions

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | ITenantEntity |
| QuizId | uuid | FK مركب → `Quizzes (Id, TenantId)` NoAction |
| QuizVersionId | uuid | يُثبَّت عند الإنشاء → `QuizVersions (Id, TenantId)` NoAction |
| JoinCode | varchar(32) | unique عالميًا — يولّد حاليًا في الخدمة بطول 8 أحرف |
| Mode | int | SelfPaced=1, Live=2 |
| Status | int | Scheduled=1, Active=2, Finished=3, Cancelled=4 |
| Label | varchar(200) nullable | عنوان وصفي اختياري للجلسة |
| ActivatedAt/FinishedAt | timestamptz nullable | |
| xmin | xid | RowVersion (`BaseVersion` لعمليات الحالة) |
| CreatedAt/UpdatedAt | timestamptz | |

### SessionParticipants

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | |
| SessionId | uuid | FK مركب → `QuizSessions (Id, TenantId)` NoAction |
| DisplayName | varchar(50) | 2..50 حرفًا |
| GuestTokenHash | varchar(64) | SHA-256 hex — الرمز الخام لا يُخزن أبدًا |
| GuestTokenExpiresAt | timestamptz | انتهاء صلاحية هوية الضيف |
| JoinedAt | timestamptz | |
| CreatedAt/UpdatedAt | timestamptz | |

### Attempts

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | |
| SessionId | uuid | FK مركب → `QuizSessions (Id, TenantId)` NoAction |
| ParticipantId | uuid | FK مركب → `SessionParticipants (Id, TenantId)` NoAction |
| ShuffleSeed | int | خلط حتمي للأسئلة لكل محاولة |
| Revision | int | يتزايد مع كل إجابة للتحكم في التزامن |
| Status | int | InProgress=1, Finished=2, TimedOut=3 |
| StartedAt | timestamptz | خادمي |
| DeadlineAt | timestamptz nullable | خادمي — settle-on-request |
| FinishedAt | timestamptz nullable | |
| CurrentQuestionIndex | int | للاستئناف بعد F5 |
| DurationMs | bigint nullable | المدة الفعلية بالمللي ثانية |
| Score/MaxScore | decimal(10,2) nullable | تُحسب عند الإنهاء |
| Percentage | decimal(5,2) nullable | النسبة النهائية |
| Passed | bool nullable | قرار النجاح الخادمي |
| xmin | xid | RowVersion للتزامن |
| CreatedAt/UpdatedAt | timestamptz | |

### AttemptAnswers

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | |
| AttemptId | uuid | FK مركب → `Attempts (Id, TenantId)` NoAction |
| QuizVersionItemId | uuid | FK مركب → `QuizVersionItems (Id, TenantId)` NoAction |
| AnswerJson | **jsonb** | يطبّعه PostgreSQL — المقارنة دلالية (ADR 008) |
| IsCorrect | bool nullable | يُحسب خادميًا عند الإرسال |
| ScoreAwarded | decimal(10,2) nullable | |
| AnsweredAt | timestamptz | |

unique per `(AttemptId, QuizVersionItemId)` — إجابة واحدة لكل سؤال (Idempotency).

## قواعد Phase 4

- رموز الضيوف: هاش SHA-256 فقط في `GuestTokenHash`؛ مقارنة ثابتة الزمن (ADR 007).
- إجابة واحدة لكل سؤال في المحاولة؛ إعادة نفس الإجابة = نجاح Idempotent، وإجابة مختلفة = 409.
- `AnswerJson` نوعه `jsonb` — PostgreSQL يطبّع التمثيل، لذا Idempotency يقارن **دلاليًا** عبر `AnswerJsonEquals` (ADR 008).
- لا Cascade Delete: كل علاقات Phase 4 `DeleteBehavior.NoAction`.
- الوقت خادمي: `StartedAt`/`DeadlineAt`/`FinishedAt` تُضبط على الخادم فقط.

## Phase 5 — الاستبانة والشهادات والتوليد غير المتزامن

### Surveys

- `Surveys`: استبانة واحدة لكل `(TenantId, QuizId)`، بحالة Draft/Published و`xmin` للتزامن.
- `SurveyQuestions`: ترتيب فريد داخل الاستبانة، ونوع `Rating` أو `SingleChoice` أو `ShortText`، ونص حتى 500 حرف.
- `SurveyOptions`: ترتيب فريد داخل السؤال ونص حتى 200 حرف؛ حذف سؤال المسودة يحذف خياراته فقط.
- `SurveyResponses`: استجابة واحدة لكل `(SurveyId, AttemptId)`، وترتبط بمحاولة مكتملة داخل المستأجر.
- `SurveyAnswers`: إجابة واحدة لكل سؤال في الاستجابة؛ تخزن واحدًا من `RatingValue` أو `SelectedOptionId` أو `TextValue` (حتى 1000 حرف) حسب النوع.

### Certificates وParentResultShares

- `CertificateTemplates`: قوالب Tenant-scoped مع اسم فريد، وقالب افتراضي واحد كحد أقصى لكل مستأجر، و`xmin` للتزامن.
- `Certificates`: شهادة واحدة لكل محاولة؛ تحفظ لقطة اسم الطالب والاختبار والنسبة ونصوص/ألوان القالب. رقم الشهادة فريد داخل المستأجر، و`PublicTokenHash` فريد عالميًا، بينما الرمز القابل لإعادة عرضه محفوظ مشفرًا عبر Data Protection في `PublicTokenProtected`.
- `ParentResultShares`: رابط نتيجة مستقل ذو `TokenHash` فريد عالميًا و`ExpiresAt`؛ لا يُخزن الرمز الخام.
- `OutboxMessages`: رسالة توليد الشهادة في نفس transaction، مع `NextAttemptAt` وعداد المحاولات وحقول القفل والمعالجة والخطأ. `PayloadJson` من نوع `jsonb`.

كل الكيانات السابقة Tenant-scoped. علاقات المحاولات/الشهادات/المشاركة `NoAction`، بينما حذف سؤال استبانة مسودة أو استجابتها يزيل العناصر التابعة المناسبة فقط.

## Phase 6 — LiveSessionStates

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | ITenantEntity + Global Filter |
| SessionId | uuid | FK مركب → `QuizSessions (Id, TenantId)`، واحد لواحد وفريد |
| Phase | int | Lobby=1, QuestionOpen=2, QuestionClosed=3, Finished=4 |
| CurrentQuestionIndex | int | يبدأ عند -1 في Lobby |
| CurrentQuizVersionItemId | uuid nullable | FK مركب → `QuizVersionItems (Id, TenantId)` |
| QuestionStartedAt/QuestionClosesAt | timestamptz nullable | سلطة الوقت الخادمية |
| Revision | int | Optimistic control لعقود Host |
| xmin | xid | RowVersion لحماية السباقات الفعلية عند الحفظ |
| CreatedAt/UpdatedAt | timestamptz | |

لا تخزن SignalR أي state موازية، ولا توجد إجابات أو Leaderboard snapshots في هذا الجدول؛ تُشتق counts والترتيب من `SessionParticipants` و`Attempts` و`AttemptAnswers` عند القراءة.

## Phase 7 — SaaS administration

- `Plans`: جدول عالمي بكود فريد، اسم، حالة، `LimitsJson` من نوع `jsonb`، و`xmin` للتزامن.
- `Subscriptions`: Tenant-scoped، FK إلى `Plans`، وحالة `Active | Suspended | Expired | Cancelled`. فهرس PostgreSQL جزئي يضمن اشتراكًا نشطًا واحدًا فقط لكل `TenantId`.
- `UsageCounters`: Tenant-scoped، فريد على `(TenantId, PeriodStart, Metric)`، ويخزن قيمة اللقطة الشهرية ونهاية الفترة ووقت التحديث.
- `AuditLogs`: سجل عالمي ذو `TenantId` اختياري و`ActorUserId` و`Action` و`EntityType` و`EntityId` و`MetadataJson` و`RequestId`. ليس `ITenantEntity` لأن Platform Admin يحتاج قراءة السجل عبر المستأجرين.
- `ReferralCodes`: Tenant-scoped، كود فريد عالميًا وسجل واحد لكل مستأجر. `ReferralEvents` Tenant-scoped ويرتبط بالكود عبر FK مركب `(ReferralCodeId, TenantId)`.

الحدود داخل `LimitsJson`: `MaxQuizzesPerTenant`, `MaxQuestionsPerQuiz`, `MaxPublishedQuizzesPerTenant`, `MaxAttemptsPerMonth`, `MaxStorageBytes`, `MaxCertificatesPerMonth`.

## Migrations

ترتيب التطبيق على قاعدة فارغة (tested in CI):
1. `20260731111834_InitialCreate` (SystemMessages)
2. `20260731210102_AddIdentity` (ASP.NET Identity + RefreshTokens)
3. `20260801125127_AddTenancy` (Tenants, Memberships, Settings)
4. `20260802040730_CreateMediaAssetsAndQuestionBank` (Phase 2)
5. `20260802223105_CreateQuizBuilderAndPublishing` (Phase 3)
6. `20260804014225_CreateSessionsAndAttempts` (Phase 4 — QuizSessions, SessionParticipants, Attempts, AttemptAnswers)
7. `20260809175242_CreateSurveys` (Phase 5 — Surveys, SurveyQuestions, SurveyOptions, SurveyResponses, SurveyAnswers)
8. `20260809185405_CreateCertificatesAndOutbox` (Phase 5 — CertificateTemplates, Certificates, ParentResultShares, OutboxMessages)
9. `20260809201234_CreateLiveCompetition` (Phase 6 — LiveSessionStates)
10. `20260809214618_CreateSaasAdministration` (Phase 7 — Plans, Subscriptions, UsageCounters, AuditLogs, Referrals)

كلها تُولّد Idempotent SQL عبر `dotnet ef migrations script --idempotent` وتُطبق يدويًا بعد Backup في أي بيئة إنتاجية.
