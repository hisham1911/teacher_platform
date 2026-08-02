# ADR 002 — تعدد العملاء Shared Schema مع Tenant Resolution + Query Filters + Write Guard

**الحالة:** معتمد (Phase 1)

## السياق

منصة تدعم عدة Workspace (Tenants) تشارك قاعدة بيانات واحدة. الهدف منع أي Tenant من قراءة أو تعديل بيانات Tenant آخر حتى لو تحكّم في Router params أو Headers، وبأقل تكلفة تشغيلية ممكنة (لا Database per tenant).

## القرار

### النموذج

- Shared Database, Shared Schema — كل جدول مملوء ببيانات Tenant يحتوي `TenantId uuid`.
- `ITenantEntity` هو العلامة الوحيدة التي تجعل الكيان يخضع للعزل. إضافته لكيان تُضيف عليه الحماية تلقائيًا.

### Tenant Resolution (Middleware)

`TenantResolutionMiddleware` يعمل بين Authentication و Authorization:

1. يقرأ `tenantId` من Route، وإذا وُجد `X-Tenant-Id` Header اختلافه يُرجع 400.
2. يتحقق من Membership نشطة في قاعدة البيانات — الـ Header **اختيار لـWorkspace فقط وليس دليل صلاحية**.
3. عند النجاح: يضبط `TenantContext` للطلب الواحد.

### Global Query Filters

`AppDbContext.ApplyTenantQueryFilters` يمرر على كل كيان يطبق `ITenantEntity` ويضيف `TenantId == CurrentTenantId`.

**الوضع الآمن عند غياب السياق: لا يُعاد أي صف** — `TenantContext` غير المحلول يعادل `Guid.Empty` فلا تطابق أي سجل حقيقي.

### Write Guard

`TenantSaveGuardInterceptor` (Singleton Stateless) عبر EF Interceptor يُنفذ على كل عملية حفظ:

- **Added**: يعيّن `TenantId` من السياق فقط، يرفض Client-supplied TenantId.
- **Modified/Deleted**: يرفض إذا كان `TenantId` الأصلي مخالفًا للسياق، إذا `TenantId.IsModified` مضبوط (ممنوع تغيير Tenant بعد الإنشاء)، أو إذا لا يوجد سياق على إطلاق.
- **Timestamps**: يعين `CreatedAt` / `UpdatedAt`.

السبب: Global Filters تحمي **القراءة** لكنها لا تمنع تحريف Id ومفاتيح أجنبية عشوائية. Interceptor خط الدفاع الثاني.

### بداية Safe Bootstrap

`TenantContext.BeginBootstrap(tenantId)` يفتح قناة محدودة داخل `CreateTenantAsync` فقط — Tenant + Owner Membership + TenantSettings تنشأ في نفس Transaction دون تجاوز العزل.

### التجاوز المركزي

`TenantBypassService` هي النقطة الوحيدة المسموح لها بـ`IgnoreQueryFilters()`. كل الطلبات الأخرى تحرك عبر إحدى هذه الأساليب العامة الموثقة ومعزولة باسم واضح:
- `ListActiveMembershipsForUserAsync`
- `FindMembershipIgnoreFiltersAsync`
- `SlugExistsAsync`
- `FindSettingsIgnoreFiltersAsync`
- `GetActiveMemberRoleIgnoreFiltersAsync`
- `IsPlatformAdminAsync`
- `FindMembershipIncludeTenantIgnoreFiltersAsync`

أي موضع آخر يستخدم `IgnoreQueryFilters()` خارج هذه الخدمة يُرفض في مراجعة الكود.

### 402/403/404 السلوك

- لا عضوية → `404` (نخفي وجود الـ Workspace)
- عضوية موقوفة → `403`
- Header لا يطابق Route → `400`
- `PlatformAdmin` لا يمكن منحه من Public Request (الـ `AddMemberAsync` يرفضه صراحة عبر `IsPlatformAdminAsync`)

## البدائل المرفوضة

- **Database per tenant**: يكسر الـBackups والـMigrations والـCost دون مكاسب أمنية حقيقية لمرحلة 단 MVP.
- **PostgreSQL RLS وحدها**: تتطلب منفذي DBA SKILL ونقاط hookup معقدة مع EF Core، وتُكمل لاحقًا عند الحاجة.
- **فحوصات يدوية في كل Controller**: أقل موثوقية، أخطاء نسيان مضمونة.

## الاختبارات و الضمانات

- `TenancyTests` تغطي: Cross-tenant read = 404, Route/Header mismatch = 400, Sequential-requests لا تتسرب Tenant Context.
- `TenantSaveGuard` تغطي: Insert بدون سياق ممنوع، تغيير TenantId ممنوع.
- Migrations تولد `Tenants`, `TenantMemberships`, `TenantSettings` — لا Test-only tables في الـSchema.
