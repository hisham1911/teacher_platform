using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// نقطة مركزية وحيدة لتجاوز Query Filters. يجب أن يُستدعى لسبب موثّق ومراجعة:
/// - قراءة عضوية مستخدم في مستأجر بهدف حلّ TenantContext قبل بنائه.
/// - قراءة قائمة Workspaces التي للمستخدم عضوية فيها بغض النظر عن السياق الحالي.
/// - قراءة slug المستأجر عبر الحدود عند الإنشاء بحثًا عن تعارض عالمي (التفرد مطبق على NormalizedSlug).
/// - قراءة صورة المستأجر دون فلتر عرض محدد مسبقًا بغرض Tenant Resolution قبل تشكيل السياق.
/// أي استخدام جديد خارج هذا المكان يحتاج ADR واختبارًا وموافقة صريحة.
/// </summary>
public sealed class TenantBypassService
{
    private readonly AppDbContext _db;

    public TenantBypassService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>يجلب عضوية مستخدم في مستأجر محدد بأي حالة (Active/Suspended), دون فلتر مستأجر.</summary>
    public Task<TenantMembership?> FindMembershipIgnoreFiltersAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return _db.TenantMemberships
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                m => m.TenantId == tenantId && m.UserId == userId,
                cancellationToken);
    }

    /// <summary>يجلب كل Workspaces التي للمستخدم عضوية نشطة فيها (لشاشة الاختيار/Onboarding).</summary>
    public async Task<IReadOnlyList<TenantMembership>> ListActiveMembershipsForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _db.TenantMemberships
            .IgnoreQueryFilters()
            .Include(m => m.Tenant)
            .Where(m => m.UserId == userId && m.Status == TenantMembershipStatus.Active)
            .ToListAsync(cancellationToken);
    }

    /// <summary>فحص وجود NormalizedSlug عبر كل الجدول (Slug عالمي التفرد) دون فلتر مستأجر.</summary>
    public Task<bool> SlugExistsAsync(string normalizedSlug, Guid? excludingTenantId, CancellationToken cancellationToken = default)
    {
        var query = _db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.NormalizedSlug == normalizedSlug);

        if (excludingTenantId is Guid excluded)
        {
            query = query.Where(t => t.Id != excluded);
        }

        return query.AnyAsync(cancellationToken);
    }

    /// <summary>يجلب Configurations TenantSettings بغض النظر عن سياق المستأجر عند الإنشاء لضمان الاثنان معاً.</summary>
    public Task<TenantSettings?> FindSettingsIgnoreFiltersAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return _db.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
    }

    /// <summary>قراءة عضوية نشطة لمستخدم في مستأجر محدد — تعرض دوره للـController/Authorization.</summary>
    public Task<TenantMemberRole?> GetActiveMemberRoleIgnoreFiltersAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return _db.TenantMemberships
            .IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.UserId == userId && m.Status == TenantMembershipStatus.Active)
            .Select(m => (TenantMemberRole?)m.Role)
            .SingleOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// هل المستخدم Platform Admin (عبر جداول Identity العالمية) — يُمنع منح العضوية لكبير المنصة عبر API العمل.
    /// يقبل قيمة AspNetUserRoles و AspNetRoles دون فلتر مستأجر (هما جداول Identity العالمية بلا TenantId).
    /// </summary>
    public async Task<bool> IsPlatformAdminAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.UserRoles
            .IgnoreQueryFilters()
            .Join(_db.Roles.IgnoreQueryFilters(), ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
            .AnyAsync(x => x.UserId == userId && x.Name == PlatformRoles.PlatformAdmin, cancellationToken);
    }

    /// <summary>
    /// قراءة عضوية مستخدم/مستأجر مع إدراج Tenant — تُستخدم من Auth.Me حين يحتوي الطلب على Tenant Resolution سابق.
    /// العضوية تكون جاهزة قبل بناء TenantContext، فلا يمكن الاعتماد على Filters.
    /// </summary>
    public Task<TenantMembership?> FindMembershipIncludeTenantIgnoreFiltersAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return _db.TenantMemberships
            .IgnoreQueryFilters()
            .Include(m => m.Tenant)
            .SingleOrDefaultAsync(m => m.TenantId == tenantId && m.UserId == userId, cancellationToken);
    }
}
