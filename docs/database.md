# قاعدة البيانات — Phase 3 (Quiz Builder & Publishing)

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

## Migrations

ترتيب التطبيق على قاعدة فارغة (tested in CI):
1. `20260731111834_InitialCreate` (SystemMessages)
2. `20260731210102_AddIdentity` (ASP.NET Identity + RefreshTokens)
3. `20260801125127_AddTenancy` (Tenants, Memberships, Settings)
4. `20260802040730_CreateMediaAssetsAndQuestionBank` (Phase 2)
5. `20260802223105_CreateQuizBuilderAndPublishing` (هذه الوحدة)

كلها تُولّد Idempotent SQL عبر `dotnet ef migrations script --idempotent` وتُطبق يدويًا بعد Backup في أي بيئةإنتاجية.
