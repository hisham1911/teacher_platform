# English Spark / Teacher Platform — Complete Updated Conversation Handover

**Authoritative handover date:** 2026-09-03 03:00 Cairo (UTC+3)  
**Purpose:** نقل كل السياق المهم من بداية العمل حتى آخر نشر Production إلى دردشة جديدة بدون فقد قرارات أو تكرار شغل أو كسر ما تم بناؤه.  
**Repository:** `https://github.com/hisham1911/teacher_platform`  
**Production Frontend:** `https://teacher-platform-vert.vercel.app`  
**Production Backend:** `https://teacher-platform-api-demo-hisham.onrender.com`  
**Primary product brand:** **English Spark**

> **مهم جدًا للدردشة الجديدة:** اقرأ الملف كاملًا قبل أي تعديل. هذه الوثيقة تحدّث وتستبدل handover يوم 2026-09-02، لأن Phase 1 ثم Phases 2/3/4 تم إنهاؤها ودمجها ونشرها بعد ذلك.

> **Security:** لا توجد هنا كلمات مرور أو API keys أو Tokens أو Secrets. لا تطلب من المستخدم لصق Secrets في الشات، ولا تضع أي Secret في Git أو `VITE_*`.

---

# 0) التعليمات التشغيلية للدردشة الجديدة — اقرأها أولًا

1. **`main` هو مصدر الحقيقة الحالي للمنتج.** لا تبدأ من feature branch قديم لمجرد أن اسمه يبدو أحدث.
2. قبل أي تعديل فعلي: افحص `main`, الفرع المقصود, Render deploy branch, وأي PR مرتبط.
3. **ممنوع force push / history rewrite / reset مدمر.** كل العمل السابق حافظ على التاريخ؛ استمر بنفس السياسة.
4. لا تطوّر Features على `deploy/render-supabase-vercel`. هذا فرع تشغيل Render فقط.
5. المستخدم قال صراحة في آخر مرحلة:
   > **"اعمل كل حاجة في البرودكشن لان احنا كده كده لسه بنجرب"**
   المعنى العملي الحالي: Production هو بيئة التجربة الفعلية للمستخدم. لا تهدر Vercel quota في previews غير لازمة. لكن يظل من الأفضل فنيًا تنفيذ الكود في branch معزول، تشغيل الاختبارات، ثم merge آمن إلى `main` ليصل Production.
6. لا تخلط Quick Join مع Student Portal:
   - `/join` = Activity/Session code سريع، بدون هوية طالب دائمة.
   - `/student` = دخول دائم بكود طالب شخصي.
7. لا تعيد بناء Progressive Challenge؛ هو منتهٍ ومختبر.
8. لا تعيد Phase 1/2/3/4 من الصفر؛ كلها أصبحت في Production.
9. أي تغيير على homepage يجب أن يراجع **PR #12** بعناية لأن هذا الـPR ما زال Open ولم يُدمج، وفيه آخر اتجاه UX صريح طلبه المستخدم قبل دمج Phase 3.
10. الأولوية دائمًا:
   `Correctness → Business Rules → Security → E2E → UX → Features`

---

# 1) الملخص التنفيذي الحالي

English Spark بدأ كموقع بسيط لمعلّمة لغة إنجليزية اسمها **Maryam** لعمل اختبارات ومسابقات للطلاب، ثم تطور تدريجيًا إلى **multi-tenant Teacher SaaS / learning-engagement platform**.

المنصة حاليًا تحتوي فعليًا على:

- Identity + roles
- Multi-tenancy / Workspaces
- Question Bank + Media
- Immutable Question Versions
- Activity/Quiz Builder
- Publish/versioning
- Excel/CSV bulk import + preview
- Atomic Activity Launch
- Self-paced activities
- Live competitions + SignalR
- Progressive Challenge
- Guest Quick Join + resume
- Persistent Student Roster
- Persistent Student Portal
- Cross-device student continuation
- Classes
- Assignments pinned to immutable Activity/QuizVersion
- Assignment recipients
- Assignment-first reporting
- Reports + CSV
- Surveys
- PDF certificates
- Parent result sharing
- Plans / subscriptions / usage
- Commercial plan limits + entitlements
- PlatformAdmin controls
- Workspace/user suspension/reactivation
- Controlled branding contract
- Arabic RTL / mobile UX
- Vercel + Render + Supabase Production

**Core domain invariant that must never be blurred:**

`Activity ≠ Assignment ≠ Session ≠ Attempt ≠ Result`

---

# 2) بداية المشروع وسياق العميل

## العميل الأصلي

- معلّمة لغة إنجليزية: **Maryam**.
- الفكرة الأصلية كانت موقعًا يُرسل رابطه للطلاب، وليس Mobile App.
- الاستخدام داخل الفصل وعلى شاشة عرض، مع أنشطة تتغير وأسئلة ومسابقات.

## المتطلبات الأصلية التي ظهرت في الدردشة

- Teacher dashboard
- تغيير الأسئلة بسهولة
- عرض عدد الطلاب وإحصائيات
- نتائج الطلاب
- Impact Survey
- مشاركة النتيجة مع ولي الأمر
- Electronic certificate
- تجربة تفاعلية ممتعة
- مسابقات بدل شكل الاختبار التقليدي
- Progressive Challenge قريب من فكرة Millionaire لكن **بدون نسخ Branding/UI/Assets محمية**
- Learning-resource directory وروابط/QR ليوتيوب
- قسم puzzles
- games / adventures / interactive riddles
- Common Words
- كلمات إنجليزية أصلها عربي
- ترجمات
- واجهة جذابة

الميزانية الأصلية التي ذُكرت كانت حوالي **$100**، لذلك تاريخيًا كان مهم منع scope creep غير المتحكم فيه. لاحقًا المنصة تطورت كمنتج SaaS أكبر من الطلب الأول.

---

# 3) توجه المنتج الذي تم تثبيته

English Spark ليس ERP ولا School Management System ولا LMS كامل.

هو أقرب إلى:

**Teacher SaaS / Learning Engagement Platform**

يركز على:

- إنشاء الأسئلة والأنشطة
- توزيع النشاط بطرق مختلفة
- اللعب/المسابقة
- Progress
- Results
- Certificates
- Classes + Assignments
- Student identity/continuity
- إدارة Workspace/Plan على مستوى SaaS

## الأسطح الأساسية

- Visitor / Student first public experience
- Teacher / Academy Studio
- Persistent Student Portal
- Guest Quick Join
- Platform Owner / PlatformAdmin

---

# 4) Tech Stack الحالي

## Frontend

- React 19
- TypeScript strict
- Vite
- React Router
- TanStack Query
- Tailwind CSS 4
- SignalR client
- Vitest
- Testing Library
- Playwright E2E
- Cairo typography
- Arabic RTL

## Backend

- ASP.NET Core / .NET 10
- Modular Monolith
- EF Core 10
- Npgsql / PostgreSQL
- Domain / Application / Infrastructure / API layers

## Infrastructure

- Vercel → Frontend SPA
- Render → Backend API
- Supabase PostgreSQL → DB
- Supabase Storage → media

Known Supabase project context from earlier handover:
- Project: `teacher-platform-demo`
- Region: Frankfurt / `eu-central-1`
- Storage bucket: `teacher-platform-media`

## Architecture rules

- لا يوجد direct DB access من frontend.
- كل Frontend HTTP calls تمر عبر `apps/web/src/data/api-client/`.
- لا يوجد Supabase SDK في Frontend runtime.
- لا توضع Secrets داخل `VITE_*`.
- Scoring/time/security server-authoritative.
- لا تثق في client-supplied tenant hints أو scores أو correctness.

---

# 5) Current authoritative Git state — 2026-09-03

## `main`

```text
90e6d356cbce5fb3780a0b67a3f9419aee8788ba
```

Commit message:

```text
chore(ci): preserve full-browser budget guard with phase coverage
```

هذا هو **current production product source of truth**.

## Render deployment branch

```text
deploy/render-supabase-vercel
056c8e5cdfc5520f5ce9e23bb409d5795832b346
```

Commit message:

```text
deploy: integrate phases 2-4 on Render
```

هذا الـcommit له Parent من Render deployment history وParent من current `main`، أي أنه يحافظ على ملفات Render الخاصة مع المنتج المتكامل.

## Phase 2 branch — historical source branch

```text
feature/phase2-classes-assignments
69615c39e7a1b92a1d01c59db2a1f98bffc9f7c5
```

Last message:

```text
fix(phase2): normalize null assignment recipient lists
```

## Phase 3 branch — historical source branch

```text
feature/phase3-product-consolidation
5cb7be22b45d742f605ef2d2fc05145a030c7e44
```

Last message:

```text
feat(phase3): surface classes and assignments for teachers
```

## Phase 4 branch — historical source branch

```text
feature/phase4-commercial-saas
be9dfcad426618bda8bcf766c47fdba1999245be
```

Last message:

```text
fix(platform): resolve tenant context for workspace suspension
```

## Student-first simplified homepage branch

```text
feature/student-first-homepage-overhaul
d3d4da055f154b5c6389430edc477a3baffef132
```

**PR #12 ما زال OPEN وغير مدموج.**

---

# 6) Current PR state المهم

## Phase 1

### PR #7 — merged

`feat: complete persistent student portal phase 1`

أصبح Phase 1 في `main` ثم Production.

### PR #8 — merged

`deploy: promote student portal phase 1 to Render`

روّج Phase 1 إلى Render deployment branch.

## Homepage iterations

### PR #9 — merged historically

`feat: refresh English Spark public homepage`

كان playful جدًا واحتوى عناصر مثل XP/streak في presentation تجريبي، ثم حصلت تعديلات لاحقة.

### PR #10 — merged historically

`feat: rebuild homepage world and interactive demo`

أضاف mini demo حقيقي وحسّن الفصل بين Activity Code وStudent Code.

### PR #11 — merged historically

`feat: showcase real English Spark capabilities on homepage`

حوّل الصفحة إلى product-story أقرب للمعلم. المستخدم رفض أن تكون `/` موجهة للمعلمين وأكد:

> **"انا عاوزها موجهة للطلاب وممكن نعمل صفحة تانية موجهة للمعلمين"**

### PR #12 — OPEN / NOT MERGED

`feat: rebuild student homepage around the core journey`

هو آخر rebuild صريح للـhomepage بعد شكوى المستخدم من التكرار وعدم الاحترافية.

تفاصيله لاحقًا في قسم Homepage.

## CI / deployment policy

### PR #17 — merged

`chore: guard CI and deployment budgets`

هذا PR مهم جدًا لأنه أوقف استنزاف Vercel من parallel branches.

## Phase 2

### PR #15 — merged

`feat: complete Phase 2 classes and assignments`

Current branch head at completion:

```text
69615c39e7a1b92a1d01c59db2a1f98bffc9f7c5
```

## Phase 3

### PR #20 — merged

`Phase 3 — Product Consolidation`

Current branch head:

```text
5cb7be22b45d742f605ef2d2fc05145a030c7e44
```

### PR #19 — closed WITHOUT merge

كان محاولة sync بين main وPhase3، لكن conflict كان في workflow/deployment guards فقط. تم إغلاقه بدل خلط CI policy داخل product branch.

### PR #18 — internal merged

Sync final Phase 2 hardening into Phase 3.

## Phase 4

### PR #13 — merged

`Phase 4 — Commercial SaaS`

Final Phase 4 branch head:

```text
be9dfcad426618bda8bcf766c47fdba1999245be
```

### PR #14 / #16 / #21

Internal integration PRs لدمج Phase2 وPhase3 داخل Phase4 أثناء العمل، بدون Production وقتها.

---

# 7) Route / Surface Architecture الحالية

```text
/                         Student-first public homepage
/teachers                 Teacher / Academy public page
/join                     Quick Join only
/student                  Persistent Student Portal login
/student/home             Persistent Student Home
/play/:joinCode           Activity Player
/dashboard                Teacher / Academy Studio
/platform                 PlatformAdmin
/q/:publicCode            Public metadata/landing; NOT solve link
/result/:publicToken      Public result
/certificate/:publicToken Public certificate
```

## قاعدة UX/Domain لا تكسرها

### `/join`

- نشاط/جلسة سريع
- Activity code / join code
- لا يمثل هوية دائمة للطالب
- guest path محفوظ

### `/student`

- Personal student access code
- persistent identity/session
- progress/resume/results/certificates

**لا تستخدم نفس copy أو نفس mental model للكودين.**

---

# 8) Domain map الحالي

## Identity

- ApplicationUser
- ApplicationRole
- RefreshToken
- UserProfile

## Tenancy

- Tenant / Workspace
- TenantMembership
- TenantSettings

## Questions

- QuestionBank
- Question
- QuestionVersion
- QuestionOption
- QuestionTag
- Media

## Activities

Backend historical naming ما زال غالبًا `Quiz`:

- Quiz
- QuizVersion
- QuizVersionItem

Product/UI naming = **Activity**.

**لا تعمل backend-wide rename من Quiz إلى Activity**؛ كان قرارًا صريحًا أن هذا غير مطلوب الآن.

## Students

- Student
- StudentPortalCredential
- StudentPortalSession

## Classes + Assignments

- Classroom
- ClassroomStudent
- Assignment
- Assignment recipients / recipient snapshots
- Assignment bound to immutable QuizVersion/ActivityVersion

## Runtime

- QuizSession
- SessionParticipant
- Attempt
- AttemptAnswer
- LiveSessionState

## Output / engagement

- Reports
- Survey
- Certificates
- Parent share

## SaaS

- Plan
- Subscription
- UsageCounter
- AuditLog
- Referral
- Commercial limits / entitlements contract
- PlatformAdmin controls

## Infrastructure domain

- Outbox

---

# 9) Progressive Challenge — DONE

**لا تعيد بناءه.**

القواعد المثبتة:

- Q1 = Level 1, Q2 = Level 2 ...
- إجابة خاطئة تنهي التحدي
- Strict current-level gate
- Server-authoritative score
- Resume
- Per-question deadline
- Atomic terminal finalization
- Wrong final answer ≠ win
- Media authorization مرتبطة بالمستوى الحالي
- Reports / CSV تحتوي level data
- Dedicated mission UI
- RTL
- Reduced motion
- Touch targets ≥ 44px
- Adversarial security + browser coverage

Progressive Challenge كان من أهم milestones المبكرة وتم دمجه قبل English Spark UX foundation.

---

# 10) Question Bank / Import / Activity Launch

## Question Bank

تم بناء:

- banks
- reusable questions
- versioned questions
- media
- tags/filtering
- single creation
- bulk import
- history/reuse

## Excel / CSV import

الـUX المقصود:

- `.xlsx`
- `.csv`
- Preview before save
- atomic server-side transaction
- الفشل لا يترك orphan questions

Historical sample columns:

```text
type,prompt,A,B,C,D,correct,difficulty,language,tags,explanation
```

Client sample quizzes التي استُخدمت سابقًا في الاختبار:

- English Challenge Quiz — 15 MCQ
- Fun & Easy English Quiz — 18 questions with levels

## Atomic Activity Launch

استُبدل flow المتعدد القديم:

```text
Publish → Create Session → Activate
```

بـtransactional server-side launch يعتمد على:

- persisted RequestId
- unique constraint
- advisory lock
- retry-safe
- concurrency-safe
- الحفاظ على stale-version semantics للـlegacy/manual sessions

---

# 11) Student Roster

Persistent tenant-scoped Student roster موجود ويشمل:

- Create
- Edit
- Activate
- Deactivate
- Rotate/regenerate code
- Search/filter
- Student profile
- tenant isolation
- optimistic concurrency
- Owner/Teacher-only sensitive code visibility
- guest fallback محفوظ

من UX passes السابقة:

- direct student-code copy من roster
- inactive students لا يظهر لهم Copy كأنه كود صالح
- Student Portal preview من Students screen

---

# 12) Phase 1 — Persistent Student Portal — COMPLETE + PRODUCTION

Phase 1 لم يعد blocker. كل عناصر closing pass القديمة تم إنهاؤها.

## ما تم فعليًا

- Personal persistent student access code
- StudentPortalCredential
- StudentPortalSession
- credential منفصل عن JoinCode وعن legacy StudentCode
- raw access code لا يتم تخزينه
- lookup digest + verifier hash
- session token hashed server-side
- HttpOnly cookie
- `__Host-` when Secure
- `/student`
- `/student/home`
- Student Portal status gating
- auto-bind student to managed activity when valid
- same-tenant enforcement
- guest flow preserved
- deactivate revokes portal sessions
- rotate / revoke
- cross-device resume
- QR + printable login card
- QR لا يضع credential نفسه داخل URL
- legacy StudentCode moved behind compatibility disclosure
- secure/unbiased random access-code generation
- expired/revoked portal-session retention cleanup ≈ 90 days
- feature flag off by default then explicitly enabled in Production env
- recent attempts wording clarified

## Browser behavior proven

Part H اختبر سيناريو:

```text
Device A starts → Device B logs into Student Portal → resume/continue
```

## Production

Phase 1 تم دمجه في `main` عبر PR #7، ثم ترويجه إلى Render عبر PR #8، وتم تفعيل Student Portal في Production environment.

---

# 13) Phase 2 — Classes + Assignments — COMPLETE + PRODUCTION

Branch source:

```text
feature/phase2-classes-assignments
69615c39e7a1b92a1d01c59db2a1f98bffc9f7c5
```

PR #15 أصبح merged.

## Classroom

تم بناء Classroom tenant-scoped مع:

- Id
- TenantId
- Name
- optional AcademicYear
- IsActive

## ClassroomStudent

Membership بين:

- Classroom
- Student

## Assignment

Assignment الآن هو Delivery Contract حقيقي وليس synonym للنشاط.

- مربوط بـimmutable published Activity/QuizVersion snapshot
- recipients
- classroom/student recipients
- optional availability/due dates حسب العقد الحالي
- recipient snapshots

## Teacher flow

تم تثبيت Product flow:

```text
Build → Preview → Assign / Share / Live
```

## Student Home

Assignment states أصبحت جزءًا من تجربة الطالب، وصياغات Phase3 دمجتها لاحقًا في UI أكثر وضوحًا.

## Security / behavior

- Student endpoint يشتق tenant/student identity من Student Portal session
- لا يثق في tenant من client
- managed assignment join يرفض guest
- managed assignment join يرفض non-recipient
- Quick Join guest path يبقى مستقلًا
- assignment start يستخدم Player الحالي
- cross-device resume محفوظ
- teacher can follow linked result/attempt

## Hardening

- whitespace-only Classroom names مرفوضة
- explicit JSON `null` recipient arrays يتم normalize إلى empty list بدل 500

## Migration

Additive EF migration:

```text
20260902180346_Phase2ClassesAssignments
```

تم تطبيقها فعليًا على Supabase Production أثناء آخر نشر Render.

Legacy QuizSessions تم backfill كـopen access للحفاظ على Quick Join القديم.

---

# 14) Phase 3 — Product Consolidation — COMPLETE + PRODUCTION

Branch source:

```text
feature/phase3-product-consolidation
5cb7be22b45d742f605ef2d2fc05145a030c7e44
```

PR #20 أصبح merged.

## Public product surfaces

- `/` student-first
- `/teachers` surface مستقلة للمعلمين/الأكاديميات
- direct Activity Code entry
- personal Student Code path منفصل
- mini-game/demo في الصفحة العامة

## Studio Golden Path

تم تثبيت:

```text
Build → Preview → Assign / Share / Live
```

- Preview للمعلم non-scoring
- يرجع Delivery section عبر stable anchor
- primary teacher copy يتجنب lifecycle jargon مثل:
  - Publish
  - QuizVersion
  - Create Session
  - Activate
- compatibility quiz routes محفوظة
- لا يوجد backend-wide rename

## Student experience

Student Home أصبح mission-oriented أكثر، ويعرض معاني من نوع:

- المطلوب مني
- أكمل
- قريبًا
- انتهيت
- تقدم
- شهادات

Assignment start يستمر عبر Player engine الحالي ويحافظ على cross-device resume.

## Reporting

`/dashboard/reports` أصبح **assignment-first**:

- recipients
- started
- completed
- per-assignment student progress
- links لمحاولة/نتيجة الطالب

Quick-share وLive runs ما زالت متاحة كتاريخ تشغيل أسفل assignment-centric path.

## Player consolidation

تم decomposition للـPlayer إلى أجزاء/concerns أصغر بدون mega rewrite، مع الحفاظ على:

- SelfPaced
- Live
- ProgressiveChallenge
- guest resume
- managed student binding
- authoritative scoring/time
- result/certificate behavior

## E2E

Phase3 أضاف/استخدم Part J لتغطية:

- student-first `/`
- `/teachers`
- Build → Preview → Assign / Share / Live
- assignment-first reports
- class discoverability

---

# 15) Phase 4 — Commercial SaaS — COMPLETE + PRODUCTION

Branch source:

```text
feature/phase4-commercial-saas
be9dfcad426618bda8bcf766c47fdba1999245be
```

PR #13 أصبح merged.

## Commercial contract

Current contract version:

```text
2
```

Grandfathered package:

```text
Legacy
```

## Supported entitlements

- `bulkImport`
- `advancedReports`
- `certificates`
- `customBranding`
- `dataExport`
- `customDomain`

## Package catalog الحالي

### Teacher — available

- Max quizzes/tenant: 50
- Max questions/quiz: 100
- Max published quizzes: 20
- Max attempts/month: 5,000
- Storage: 1 GB
- Certificates/month: 200
- Students: 150
- Members: 1
- Classes: 10
- Active assignments: 20
- Live participants: 50
- Entitlements المذكورة أعلاه افتراضيًا غير مفعلة في catalog Teacher الحالي.

### Teacher Pro — available

- Max quizzes/tenant: 250
- Max questions/quiz: 200
- Max published quizzes: 100
- Max attempts/month: 50,000
- Storage: 10 GB
- Certificates/month: 5,000
- Students: 1,000
- Members: 5
- Classes: 75
- Active assignments: 250
- Live participants: 250
- Entitlements enabled:
  - bulkImport
  - advancedReports
  - certificates
  - customBranding
  - dataExport

### Academy — available

- Max quizzes/tenant: 1,000
- Max questions/quiz: 300
- Max published quizzes: 500
- Max attempts/month: 500,000
- Storage: 100 GB
- Certificates/month: 50,000
- Students: 10,000
- Members: 50
- Classes: 500
- Active assignments: 2,500
- Live participants: 1,000
- Entitlements enabled:
  - bulkImport
  - advancedReports
  - certificates
  - customBranding
  - dataExport

### School — reserved / unavailable now

Display:

```text
School (Later)
```

`IsAvailable = false`

Reserved limits:

- quizzes: 10,000
- questions/quiz: 500
- published quizzes: 5,000
- attempts/month: 5,000,000
- storage: 1 TB
- certificates/month: 500,000
- students: 100,000
- members: 500
- classes: 5,000
- active assignments: 20,000
- live participants: 5,000
- customDomain entitlement reserved here

**لا تعتبر School package جاهز للبيع الآن.**

## Phase4 functionality

- Plan catalog / contracts
- Subscription state
- Workspace commercial state
- PlatformAdmin plan/subscription controls
- Usage / capacity enforcement
- Student limit
- Member limit
- Class limit
- Active assignment limit
- Live participant limit
- concurrency protection where needed
- user suspension
- workspace suspension/reactivation
- entitlement gates
- controlled branding

## Important business-rule hardening

### Future subscription activation

Future `StartsAt` scheduling يتم رفضه حاليًا بدل إلغاء الاشتراك الحالي بالخطأ، إلى أن يوجد lifecycle حقيقي لـScheduled subscriptions.

### Live quota scope

`MaxLiveParticipants` ينطبق على **SessionMode.Live فقط**.

لا يقيّد SelfPaced أو ProgressiveChallenge بنفس limit التجاري المخصص للـLive.

### Workspace suspension

PlatformAdmin suspension يمنع:

- anonymous Player routes
- managed student joins

مع error semantics مثل `WorkspaceSuspended`.

Reactivation يعيد الوصول.

Historical public result/certificate surfaces لم تُربط باشتراك workspace بطريقة تكسر روابط النتائج القديمة.

### Package validation

PlatformAdmin plan writes ترفض package names غير المعروفة.

### DueAt

`DueAt` يظل visible deadline حسب ADR الحالي، وليس hard-start gate جديد تم اختراعه في Phase4.

### MaxActiveAssignments

يعتمد على active assignment sessions / lifecycle الحالي وليس كل assignments التاريخية.

## Bug مهم تم اكتشافه قبل Production

قبل آخر نشر ظهر Bug حقيقي:

- إيقاف Workspace من PlatformAdmin كان يرجع 500 في مسار يتعامل مع student sessions.
- السبب: tenant context لم يكن مُنشأ بالطريقة الصحيحة داخل PlatformAdmin suspension flow.
- تم إصلاحه في:

```text
be9dfcad426618bda8bcf766c47fdba1999245be
fix(platform): resolve tenant context for workspace suspension
```

بعد الإصلاح تم إعادة الاختبارات قبل Production.

---

# 16) Homepage history — مهم جدًا لأن فيه PR مفتوح

هذا الجزء مهم جدًا حتى لا تكرر الدردشة الجديدة نفس دورة التصميم.

## الاتجاهات التي تم رفضها

المستخدم اشتكى من نسخة homepage السابقة بصيغة واضحة جدًا:

> **"تنسيق الصفحة مش احترافي خالص والمحوي فيه تكرار كتير عيب عليك والله حاول تبنيها من البداية وتسهلها علي نفسك كده"**

المشاكل التي رفضها:

- تكرار المحتوى
- كثرة البلوكات/cards
- كثرة CTA المكررة
- زخارف وحركة كثيرة
- صفحة تشبه AI landing page أكثر من تجربة منتج واضحة
- تحويل `/` إلى صفحة معلم رغم أنه يريدها للطلاب

## قرار المنتج الصريح

- `/` = Student-first
- `/teachers` = Teacher marketing/public surface

## PR #12 — simplified homepage rebuild

Branch:

```text
feature/student-first-homepage-overhaul
```

HEAD:

```text
d3d4da055f154b5c6389430edc477a3baffef132
```

Status:

```text
OPEN
NOT MERGED
```

### Philosophy

النسخة أعيد بناؤها حول **3 أقسام فقط**:

1. Start activity
2. 3 play modes
3. Student space

تم حذف:

- old 5-card grid
- four-step adventure/path
- repeated final CTA
- floating decorations
- orbits
- multi-gradient full page
- duplicate explanations

### Hero في PR #12

- kicker: `ENGLISH SPARK · للطالب`
- heading:
  - `ادخل النشاط.`
  - `وخلي تركيزك في السؤال.`
- Activity code form حقيقي
- accepts plain code or full `/play/...` URL
- button → `/play/${normalized}`
- secondary Student Portal link → `/student`

### Mini challenge

3 demo questions:

1. Book → كتاب
2. `I ___ happy.` → am
3. 🍎 → Apple

- progress
- answer feedback
- correct answer on wrong
- final score
- replay
- **بدون XP/coins invented gamification**

### Section 2

3 play modes:

- نشاط فردي
- مسابقة مباشرة
- تحدّي متدرّج

### Section 3

Student space:

- resume saved attempt
- results
- certificates
- `/student`

## مهم: ماذا يوجد في Production الآن؟

`main` الحالي يحتوي Student-first homepage من Phase3 integration، مع `/teachers` وActivity code وMini-game، لكنه **ليس merge حرفيًا لـPR #12**.

الـhomepage الحالي في `main` يحتوي أيضًا Student Moments/cards مثل:

- ادخل بسرعة
- العب بطريقتك
- كمّل من مكانك
- شاهد تقدمك

ومع hero مختلف وبعض decorative elements.

### النتيجة العملية

إذا طلب المستخدم لاحقًا تحسين الصفحة الرئيسية:

1. لا تفترض أن PR #12 تم دمجه.
2. قارن current `main` مع PR #12.
3. حافظ على آخر preference صريح للمستخدم: **أقل تكرار، أقل cards، hierarchy أبسط، student-first**.
4. استفد من `/teachers` والـPhase3 product semantics الموجودة في main.
5. لا تعمل blind merge لـPR #12 لأنه قد يعيد تغييرات routing/tests قديمة فوق Phase3/4.

---

# 17) UX / UI principles المثبتة

## عام

- الطالب هو أعلى أولوية في Public product surface.
- المعلم ضعيف تقنيًا نسبيًا → صفحة Studio يجب أن توضح next action بدون jargon.
- one primary action per surface قدر الإمكان.
- human Arabic, neutral tone.
- لا تستخدم صياغة مؤنثة للمعلمة في product copy العام.
- RTL صحيح.
- Cairo font.
- focus states واضحة.
- reduced motion.
- touch targets ≥ 44px.
- no horizontal overflow.
- mobile-first.
- playful but professional.
- لا تملأ الصفحة بزخارف بلا وظيفة.

## المصطلحات

أخفِ عن المستخدم lifecycle internals قدر الإمكان:

- Publish
- QuizVersion
- Create Session
- Activate

استخدم product language مثل:

```text
Build → Preview → Assign / Share / Live
```

## Student code semantics

- Activity Code: نشاط محدد
- Personal Student Code: مساحة الطالب الدائمة

لا تخلطهما في label أو hint أو CTA.

---

# 18) Security invariants

- Server-authoritative scoring/time.
- لا تثق في client correctness أو score.
- لا تثق في client tenant hints.
- Managed Student binding same-tenant only.
- Raw portal codes لا تُخزّن أو تُlog.
- Session tokens hashed server-side.
- HttpOnly / Secure / SameSite مناسب.
- rotate/revoke/deactivate invalidates portal sessions.
- Guest auth يبقى منفصلًا عن Student Portal.
- نفس display name لا يعني resume لنفس guest.
- no stale/duplicate scoring.
- no cross-participant data leakage.
- assignment recipient enforcement server-side.
- anonymous guest لا يدخل managed assignment.
- Workspace suspension enforcement لا يجب أن يعتمد على client.
- no secrets in Git.
- no secrets in `VITE_*`.

---

# 19) SaaS / PlatformAdmin

English Spark هو Platform واحدة بها عدة Tenants/Workspaces.

## PlatformAdmin منفصل عن tenant roles

`/platform` يستخدم لإدارة:

- users
- workspaces
- status
- plan
- subscription
- usage
- suspension/reactivation

من passes سابقة:

- account search
- suspend/reactivate
- token revocation
- audit logging
- self-lock prevention

## Important

Production PlatformAdmin account موجود، لكن credentials intentionally omitted.

---

# 20) Vercel rate-limit incident وما تم تغييره

أثناء العمل المتوازي على Phase2/3/4 وhomepage، Vercel كان ينشر Preview لكل branch/commit، فتم استنزاف quota بسرعة.

الخطأ الذي ظهر:

```text
Deployment rate limited — retry in 24 hours.
```

تم التحقق وقتها أن Hobby له daily/build-rate limits، وأن preview deployments تدخل في quota.

## القرار

Agent/feature branches لا تحتاج Vercel Preview تلقائيًا.

## PR #17

تم إضافة CI/deployment budget guard.

Current `apps/web/vercel.json` يحتوي منطقًا من نوع:

```json
{
  "git": {
    "deploymentEnabled": {
      "**": false,
      "main": true,
      "preview/**": true
    }
  }
}
```

أي:

- أي feature branch عادي → لا Vercel deploy
- `main` → Production deploy
- `preview/**` → preview مسموح عند الحاجة فقط

## CI budget policy

تم أيضًا تقليل heavy CI triggers:

- Full Browser E2E مخصص للـpreview/manual gates بدل كل branch push
- Golden Path workflow manual-only في policy التي أضيفت
- Foundation CI يركز على main/preview
- concurrency cancellation
- npm cache حيث آمن

## Current user policy

بسبب أن المنتج ما زال تجريبيًا، المستخدم اختار أن **يجرب مباشرة على Production** بدل فتح preview لكل تعديل.

لا تُلغِ guard بدون سبب.

---

# 21) Render deployment architecture

## Render service

- Auto Deploy كان **OFF** عند آخر مراجعة.
- الخدمة تتبع:

```text
deploy/render-supabase-vercel
```

وليس `main` مباشرة.

## لماذا يوجد deploy branch منفصل؟

لأن Render يحتاج ملفات تشغيل/بنية خاصة، ومنها Docker/runtime configuration. تاريخيًا كان الفرق بين product tree وRender branch مجموعة صغيرة من deployment files (حوالي 7 ملفات في آخر integration review).

## قاعدة

- Product development → feature/main
- Render deployment-specific configuration → deploy branch
- عند النشر: integrate current main/product مع الحفاظ على Render files/history

## Migration behavior الحالي

Render Docker path يبني **EF migration bundle** ويشغله **قبل API startup**.

هذا مهم جدًا.

آخر نشر أثبت السلسلة:

```text
Applying migration '20260902180346_Phase2ClassesAssignments'.
Done.
```

ثم API أصبح Live.

إذا migration فشلت، لا نريد أن يتحول الترافيك إلى API جديد فوق schema قديم.

---

# 22) آخر Production deployment — chronology دقيقة

آخر نشر شامل كان بعد أن قال المستخدم إنه يريد كل شيء على Production للتجربة.

## Step 1 — Final bug discovery

قبل النشر النهائي، Commercial SaaS E2E كشف مشكلة Workspace suspension → 500 بسبب tenant context.

## Step 2 — Fix

تم الإصلاح على Phase4:

```text
be9dfcad426618bda8bcf766c47fdba1999245be
```

## Step 3 — Verification

تم تشغيل final Foundation + Full Browser gates بعد الإصلاح وأصبحت Green، بما فيها Commercial SaaS coverage.

تم أيضًا استخدام Golden Path / Full Browser coverage في مراحل الـhomepage/Phase3 السابقة.

## Step 4 — Final integration

تم تجهيز integration نظيف يحافظ على:

- Phase2
- Phase3
- Phase4
- current main CI/Vercel budget guard
- no force push
- no history rewrite

## Step 5 — Render deployment branch integration

تم دمج المنتج النهائي مع Render deployment history مع الحفاظ على Render-specific files.

Final Render branch:

```text
056c8e5cdfc5520f5ce9e23bb409d5795832b346
```

## Step 6 — Backend deploy

Render deploy ID:

```text
dep-dacb9c2jnfac73bti7j0
```

Commit:

```text
056c8e5cdfc5520f5ce9e23bb409d5795832b346
```

Status النهائي:

```text
live
```

## Step 7 — Production DB migration

تم تطبيق:

```text
20260902180346_Phase2ClassesAssignments
```

على Supabase Production بنجاح.

## Step 8 — Move `main`

بعد Backend health، تم تحريك `main` للنسخة المتكاملة بدون force push.

Current main:

```text
90e6d356cbce5fb3780a0b67a3f9419aee8788ba
```

## Step 9 — Vercel Production

Vercel deployment لـ`main` أصبح Ready/Success.

GitHub combined status على current main يظهر Vercel = success.

## Step 10 — Production smoke test

تم فحص الدومين الحقيقي وليس preview فقط.

Routes التي رجعت 200 / Production SPA correctly:

- `/`
- `/teachers`
- `/join`
- `/student`
- `/auth/login`

تم التأكد أيضًا أن Production frontend bundle مربوط بعنوان Render Production الصحيح.

---

# 23) Production URLs الحالية

## Frontend

```text
https://teacher-platform-vert.vercel.app
```

## Backend

```text
https://teacher-platform-api-demo-hisham.onrender.com
```

هذه هي الروابط التي يستخدمها المستخدم الآن للتجربة الفعلية.

---

# 24) Quality gates / Testing

## Frontend baseline

```bash
cd apps/web
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

## Backend baseline

```bash
cd backend
dotnet restore
dotnet format --verify-no-changes
dotnet build
dotnet test
```

## Additional gates used in project

- vulnerability audit
- domain tests
- API tests
- real PostgreSQL integration
- fresh database migration
- migration idempotency SQL
- publish smoke
- Foundation CI
- English Spark Golden Path E2E
- Full Browser E2E

## Important E2E parts accumulated over time

- Builder
- Progressive Challenge
- guest resume
- reports
- Live competition
- managed students
- Part H cross-device Student Portal
- Part I Classes + Assignments + recipient isolation + result linkage / commercial coverage depending current suite split
- Part J Product Consolidation surfaces

**لا تدّعي green على commit جديد قبل تشغيل gate المناسب على نفس code state.**

---

# 25) Product flows التي يجب الحفاظ عليها

## Teacher

```text
Build → Preview → Assign / Share / Live
```

## Guest Student

```text
Activity Code / link → /join or direct /play → play → result
```

## Persistent Student

```text
Personal Student Code → /student → /student/home → assignment/activity → resume/progress/results/certificates
```

## Assignment

```text
Published immutable ActivityVersion
→ Assignment
→ Recipients/Class
→ Student sees task
→ Player session
→ Attempt
→ Result
→ Teacher assignment-first report
```

---

# 26) Core product invariants

لا تختصر هذه الأشياء في Entity واحدة:

### Activity
المحتوى/التجربة التي يبنيها المعلم.

### Assignment
عقد تسليم ActivityVersion محدد لمجموعة طلاب/فصل.

### Session
Runtime execution.

### Attempt
محاولة حل واحدة.

### Result
المحصلة/المخرجات التي تعرض أو تُشارك.

مرة أخرى:

```text
Activity ≠ Assignment ≠ Session ≠ Attempt ≠ Result
```

---

# 27) Do NOT build unless user explicitly changes scope

القرارات السابقة منعت تحويل المنتج إلى شيء أوسع بدون داعٍ.

لا تبنِ الآن تلقائيًا:

- Parent accounts
- Attendance
- Timetable
- Chat
- Full LMS courses
- File homework
- Payment gateway
- Social feed
- ERP
- Global student identity across unrelated schools
- DB-wide RLS rewrite
- backend-wide Quiz → Activity rename
- arbitrary white-label CSS/HTML/JS
- extra XP / coins / lifelines invented gamification
- custom-domain provisioning لمجرد وجود entitlement field

## Commercial exclusions الحالية

- Payment gateway غير موجود عمدًا.
- School package reserved later.
- CustomDomain entitlement موجود كconcept/reserved path وليس provisioning system جاهز.

---

# 28) Known current risks / unfinished items

## 1. PR #12 still open

أكبر نقطة UX غير محسومة تنظيميًا:

```text
PR #12 open / not merged
```

والمستخدم كان يفضل اتجاهه المبسط.

Production current main فيه homepage مختلفة قليلًا من Phase3 integration.

**إذا جاءت شكوى جديدة عن homepage، ابدأ بالمقارنة بين main وPR #12 بدل تصميم ثالث من الصفر.**

## 2. Main branch protection

آخر GitHub branch metadata أظهر أن `main` غير محمي (`protected=false`).

هذا ليس طلبًا تلقائيًا لتغيير repository policy، لكنه يعني أن الدردشة الجديدة يجب أن تكون حذرة جدًا وألا تستخدم force update أو mutations غير لازمة.

## 3. Production is currently a test environment by user choice

المنتج ليس في مرحلة customer-critical stable release حسب قرار المستخدم الأخير، لذلك هو يريد رؤية التعديلات على Production بسرعة.

هذا لا يعني تجاهل migrations/health/tests.

## 4. Vercel quota

لا ترجع لتفعيل preview deployments على كل feature branch وإلا قد يتكرر rate limit.

## 5. QuestPDF/commercial licensing

من handover السابق: راجع licensing قبل commercial scale إذا استمر استخدام QuestPDF في certificates.

---

# 29) ملفات مهمة اقرأها في Repo قبل أي تعديل كبير

ابدأ بـ:

- `AGENTS.md`
- `teacher-saas-implementation-plan-ar.md`
- `docs/architecture.md`
- `docs/development.md`
- `docs/deployment.md`
- `docs/english-spark-product-direction.md`
- `docs/decisions/*`
- Student Portal ADR
- Assignment / DueAt ADRs الموجودة حاليًا

Frontend key areas:

- `apps/web/src/app/router.tsx`
- `apps/web/src/data/api-client/*`
- `apps/web/src/routes/public/*`
- `apps/web/src/routes/student/*`
- `apps/web/src/routes/play/*`
- `apps/web/src/routes/dashboard/*`
- `apps/web/src/routes/platform/*`
- `apps/web/vercel.json`

Backend key areas:

- `backend/src/TeacherPlatform.Domain/*`
- `backend/src/TeacherPlatform.Application/*`
- `backend/src/TeacherPlatform.Infrastructure/Services/*`
- `backend/src/TeacherPlatform.Infrastructure/Persistence/*`
- `backend/src/TeacherPlatform.Api/Controllers/*`

Tests:

- `backend/tests/TeacherPlatform.IntegrationTests/*`
- `e2e/tests/*`
- `.github/workflows/*`

---

# 30) User working style / collaboration preferences

هذا مهم حتى الدردشة الجديدة لا تكرر أخطاء التواصل.

## المستخدم يفضل

- الرد العملي المباشر
- التنفيذ end-to-end عندما الأدوات متاحة
- عدم التوقف كل خطوة لطلب موافقة على تفاصيل واضحة
- عدم ادعاء نجاح tests/deploy قبل التحقق
- UX نظيف وغير معقد
- Arabic طبيعي غير AI-like
- عدم الإفراط في المصطلحات التقنية أمام العميل
- عند كتابة رسائل للعملاء: لهجة مصرية/عامية طبيعية، قصيرة، غير مبالغ فيها
- في المشروع نفسه: copy عربية واضحة ومحايدة

## المستخدم يرفض

- تكرار المحتوى
- Landing pages المليئة بالـcards والـdecorations
- technical jargon أمام المستخدم الضعيف تقنيًا
- ألقاب أو claims مبالغ فيها
- كود غير نظيف أو workaround غير مدروس
- force/reset destructive Git operations
- “نجح” بدون دليل

## في UI الطالب

المستخدم يريد تجربة طالب واضحة وممتعة لكن **لا يريد invented terminology أو gamification عشوائي**.

---

# 31) Timeline مختصرة لأهم milestones

## قبل 2026-08-23

- Teacher Platform foundation
- multi-tenancy
- question/quiz system
- live/self-paced/report/certificate/survey foundations

## 2026-08-23 تقريبًا

- Progressive Challenge completed and merged
- production Render sync

## 2026-08-27 → 2026-08-31

- English Spark UX foundation
- student-first Studio improvements
- Question Bank UX
- Students UX
- Activity sharing
- `/join` accepts full activity URL
- PlatformAdmin account controls
- Production release via PR #6

## 2026-09-02 early

- Comprehensive technical/product review
- Phase 1 Student Portal closing pass
- PR #7 merged
- Render deployment PR #8
- Student Portal production enablement

## 2026-09-02 homepage passes

- PR #9 playful refresh
- PR #10 interactive demo/world
- PR #11 product story
- user rejects teacher-first/repetitive direction
- PR #12 simplified student-first rebuild created and left isolated

## 2026-09-02 parallel roadmap

- Phase2 Classes + Assignments
- Phase3 Product Consolidation
- Phase4 Commercial SaaS
- parallel branches coordinated to avoid overwriting each other

## 2026-09-02 Vercel incident

- parallel branch previews exhausted Hobby deployment/build quota
- PR #17 deployment/CI guard merged

## 2026-09-02 late

- Phase2 completed / PR #15
- Phase3 completed / PR #20
- Phase4 completed / PR #13
- tenant-context suspension bug discovered and fixed
- unified gates green

## 2026-09-03 around midnight–03:00 Cairo

- Render deploy branch integrated
- EF migration applied on Production
- Backend Live
- `main` moved to final integration
- Vercel Production success
- smoke tests on real production URLs
- user requests this updated handover for a new chat

---

# 32) What the next chat should do FIRST

لا تبدأ coding تلقائيًا لمجرد قراءة الملف.

عند أول طلب جديد من المستخدم:

1. افحص current `main` SHA وتأكد أنه ما زال:

```text
90e6d356cbce5fb3780a0b67a3f9419aee8788ba
```

2. افحص Render deployment branch وتأكد أنه ما زال:

```text
056c8e5cdfc5520f5ce9e23bb409d5795832b346
```

3. إذا تغير أي SHA بعد تاريخ هذا الملف، اعتبر Git هو الحقيقة الجديدة واقرأ diff قبل العمل.

4. إذا الطلب Homepage/UX:
   - اقرأ current main homepage.
   - اقرأ PR #12.
   - لا تعيد تصميم من الصفر قبل المقارنة.

5. إذا الطلب Feature جديد:
   - لا تعمل مباشرة في deploy branch.
   - branch معزول → tests → merge main → Production.
   - لا Vercel preview إلا عند حاجة واضحة (`preview/**`).

6. إذا الطلب Production issue:
   - Backend health / Render logs أولًا.
   - schema/migration compatibility.
   - frontend deployment/status.
   - smoke actual production URL.

---

# 33) Current continuation checkpoint — copy this to the top of any new coding session

```text
PROJECT: English Spark / teacher_platform
REPO: hisham1911/teacher_platform

PRODUCTION FRONTEND:
https://teacher-platform-vert.vercel.app

PRODUCTION BACKEND:
https://teacher-platform-api-demo-hisham.onrender.com

MAIN:
90e6d356cbce5fb3780a0b67a3f9419aee8788ba

RENDER DEPLOY BRANCH:
deploy/render-supabase-vercel
056c8e5cdfc5520f5ce9e23bb409d5795832b346

PHASE 2 SOURCE BRANCH:
feature/phase2-classes-assignments
69615c39e7a1b92a1d01c59db2a1f98bffc9f7c5

PHASE 3 SOURCE BRANCH:
feature/phase3-product-consolidation
5cb7be22b45d742f605ef2d2fc05145a030c7e44

PHASE 4 SOURCE BRANCH:
feature/phase4-commercial-saas
be9dfcad426618bda8bcf766c47fdba1999245be

OPEN HOMEPAGE PR:
#12
feature/student-first-homepage-overhaul
d3d4da055f154b5c6389430edc477a3baffef132
OPEN / NOT MERGED

PRODUCTION DB MIGRATION APPLIED:
20260902180346_Phase2ClassesAssignments

RENDER DEPLOY ID:
dep-dacb9c2jnfac73bti7j0
STATUS: live

PRODUCT RULE:
Activity ≠ Assignment ≠ Session ≠ Attempt ≠ Result

ROUTE RULE:
/join = Activity Quick Join
/student = Persistent Student Portal

DEPLOY POLICY:
Production is currently used for user testing.
Feature branches must not auto-deploy to Vercel.
main deploys Production.
preview/** is the only optional Preview path.
No force push / no destructive history rewrite.
```

---

# 34) Suggested prompt to attach with this file in the new chat

انسخ هذه الرسالة مع الملف إذا أردت أن تبدأ الدردشة الجديدة بأقل احتمال لفقد السياق:

> اقرأ ملف الـhandover المرفق كاملًا قبل أي تنفيذ. اعتبر GitHub/Render/Vercel الحالة الحقيقية إذا اختلفت عن أي SHA مكتوب في الملف. لا تعيد بناء أي Phase موجودة، ولا تعمل force push أو reset مدمر. `main` هو مصدر الحقيقة الحالي، وفرع Render للنشر فقط. المنصة الآن في Production للتجربة، لذلك بعد أي تعديل مطلوب: اعمل implementation نظيف على branch معزول، شغّل الاختبارات المناسبة، ادمج بأمان إلى `main` ثم تحقق من Render/Vercel والدومين الحقيقي. لو الموضوع يخص الصفحة الرئيسية، راجع PR #12 المفتوح وقارنه بالـhomepage الحالية قبل أي redesign جديد.

---

# 35) Final handover statement

حتى لحظة إنشاء هذا الملف:

- Phase 1 Persistent Student Portal: **Done + Production**
- Phase 2 Classes + Assignments: **Done + Production**
- Phase 3 Product Consolidation: **Done + Production**
- Phase 4 Commercial SaaS: **Done + Production**
- Backend Render: **Live**
- Supabase Phase2 migration: **Applied**
- Vercel Production: **Success**
- Real production smoke routes: **Working**
- Vercel deployment budget guard: **Active**
- Simplified Homepage PR #12: **Still Open / Not merged**

هذه هي نقطة البداية الصحيحة لأي دردشة جديدة.
