# قاعدة البيانات — Phase 2 (Section Media/Questions)

التعريفات الإضافية فوق Phase 0/1:

## MediaAssets

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK | GUID من الخادم |
| TenantId | uuid | ITenantEntity — في Global Filter وGuard |
| ObjectKey | varchar(500) unique | يجهز، GUID-only؛ لا مسارات مطلقة |
| MimeType | varchar(100) | المؤكد بدس Magic bytes (لا الثقة بالمرسل) |
| SizeBytes | bigint | |
| Kind | int | Image=1, Audio=2 |
| Status | int | Active / Orphaned |
| OriginalFileName | varchar(260) | للعرض فقط (غير موثوق أمنيًا) |
| CreatedBy | uuid | |
| CreatedAt/UpdatedAt | timestamptz | Guard المركزي |

أداول تفوق: `AK (Id, TenantId)` ليتمكن سوال (معه composite FK) من الإشارة بأمان Cross-tenant safe.

## QuestionBanks

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | |
| Name | varchar(120) | |
| Description | varchar(2000) nullable | |

## Questions

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| TenantId | uuid | |
| BankId | uuid | FK مركب إلى `QuestionBanks (Id, TenantId)` — NoAction |
| Status | int | Active / Archived |
| CurrentVersionId | uuid nullable | آخر نسخة نشطة؛ نحن NS لها نمطياً لأن الإنشاء معاملة واحدة |
| xmin | xid | RowVersion for optimistic concurrency (`Version` property) |

## QuestionVersions (Immutable)

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK + `AK (Id, TenantId)` | |
| QuestionId, TenantId | FK مركب → `Questions (Id, TenantId)` NoAction | |
| VersionNumber | int | unique per (QuestionId, VersionNumber) |
| QuestionType | int | MC=1, TF=2, ShortAnswer=3, Ordering=4, Listening=5 |
| Prompt/Explanation | varchar(2000) / nullable | |
| Difficulty | int | |
| Language | varchar(10) (`ar`/`en`) | |
| ConfigJson | jsonb | محدود: `acceptedAnswers` للإجابة القصيرة |
| MediaAssetId | uuid nullable | FK مركب → `MediaAssets (Id, TenantId)` NoAction |

## QuestionOptions

| Column | Type | Notes |
|--------|------|-------|
| Id | uuid PK | |
| TenantId | uuid | مكرر مراعًاة للسلامة المركبة |
| QuestionVersionId | uuid | FK مركب → `QuestionVersions (Id, TenantId)` |
| SortOrder | int | unique per (QuestionVersionId, SortOrder) |
| OptionText | varchar(500) | |
| IsCorrect | bool | |

## QuestionTags / QuestionTagLinks

- Tags: `(TenantId, NormalizedName)` UNIQUE، و`AK (Id, TenantId)`.
- Links: Composite PK `(QuestionId, TagId)`، وFKs مزدوجة إلى Questions وTags بالزوج `(X, TenantId)`.

## قواعد Phase 2

- لا Binary: المحتوى خارج PostgreSQL (IObjectStorage).
- لا Cross-tenant FK: كل FK بين جداول Tenant-owned مركب ويشير لطرفي (Id + TenantId).
- لا Cascade Delete: كل علاقات Phase 2 `DeleteBehavior.NoAction`.
- لا حذف نسخ/خيارات: Archive State فقط.

## Migrations

ترتيب التطبيق على قاعدة فارغة (tested in CI):
1. `20260731111834_InitialCreate` (SystemMessages)
2. `20260731210102_AddIdentity` (ASP.NET Identity + RefreshTokens)
3. `20260801125127_AddTenancy` (Tenants, Memberships, Settings)
4. `20260802040730_CreateMediaAssetsAndQuestionBank` (هذه الوحدة)

كلها تُولّد Idempotent SQL عبر `dotnet ef migrations script --idempotent` وتُطبق يدويًا بعد Backup في أي بيئةإنتاجية.
