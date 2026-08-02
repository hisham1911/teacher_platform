using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Domain.Metadata;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// سياق قاعدة البيانات الموحد:
/// - Identity متوافق مع ASP.NET Core Identity بمفاتيح Guid.
/// - Global Query Filters على الكيانات المملوكة لمستأجر (ITenantEntity).
/// - الوضع الآمن الافتراضي: بدون سياق مستأجر لا تُعرض بيانات المستأجر.
/// المرحلة 1 تضيف Identity + Tenancy فوق جدول SystemMessages من المرحلة 0.
/// </summary>
public class AppDbContext(
    DbContextOptions<AppDbContext> options,
    ITenantContext tenantContext)
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options)
{
    private readonly ITenantContext _tenantContext = tenantContext;

    /// <summary>
    /// يُستخدم داخل Query Filter فقط. EF Core يعيد تقييمه على سياق التنفيذ الحالي في زمن
    /// الاستعلام — القيمة غير المحقونة تساوي Guid.Empty فلا ينتج الفلتر أي صف (الوضع الآمن الافتراضي).
    /// </summary>
    public Guid? CurrentTenantId => _tenantContext.TenantId;

    public DbSet<SystemMessage> SystemMessages => Set<SystemMessage>();

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Tenancy sets — تُخفى من النموذج عندما تُجمد Tenancy أثناء توليد AddIdentity
    private DbSet<Tenant>? _tenants;
    private DbSet<TenantMembership>? _tenantMemberships;
    private DbSet<TenantSettings>? _tenantSettings;

    public DbSet<Tenant> Tenants => GetTenancySet(ref _tenants);
    public DbSet<TenantMembership> TenantMemberships => GetTenancySet(ref _tenantMemberships);
    public DbSet<TenantSettings> TenantSettings => GetTenancySet(ref _tenantSettings);

    /// <summary>يتحكم بتفعيل Tenancy عبر متغير بيئة لاستيعاب توليد AddIdentity منفردًا.</summary>
    public static bool IncludeTenancyInModel =>
        !string.Equals(Environment.GetEnvironmentVariable("SKIP_TENANCY_MODEL"), "1", StringComparison.Ordinal);

    private DbSet<T> GetTenancySet<T>(ref DbSet<T>? backing) where T : class
    {
        if (!IncludeTenancyInModel)
        {
            throw new InvalidOperationException(
                "Tenancy model is paused (SKIP_TENANCY_MODEL=1). Reset the flag before runtime usage.");
        }
        return backing ??= Set<T>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // التكوينات غير المستأجرة (Identity profiles/refresh tokens/SystemMessages)
        modelBuilder.ApplyConfiguration(new Configurations.UserProfileConfiguration());
        modelBuilder.ApplyConfiguration(new Configurations.RefreshTokenConfiguration());
        modelBuilder.ApplyConfiguration(new Configurations.SystemMessageConfiguration());

        if (IncludeTenancyInModel)
        {
            modelBuilder.ApplyConfiguration(new Configurations.TenantConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.TenantMembershipConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.TenantSettingsConfiguration());
        }
        else
        {
            modelBuilder.Ignore<Tenant>();
            modelBuilder.Ignore<TenantMembership>();
            modelBuilder.Ignore<TenantSettings>();
        }

        ApplyTenantQueryFilters(modelBuilder);
    }

    private void ApplyTenantQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(ITenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                continue;
            }

            // الوضع الآمن الافتراضي: إذا لم يُحلّ سياق المستأجر لا يعرض أي صف
            // (TenantContext غير المحلول = Guid.Empty لا يطابق أي سجل حقيقي).
            var filter = TenantQueryFilterConvention.BuildTenantFilter(entityType.ClrType, this);
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
