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

    // Phase 2 — MediaAssets & Question Bank (Tenant-owned، Global Filters مطلوبة)
    public DbSet<Domain.Media.MediaAsset> MediaAssets => Set<Domain.Media.MediaAsset>();
    public DbSet<Domain.Questions.QuestionBank> QuestionBanks => Set<Domain.Questions.QuestionBank>();
    public DbSet<Domain.Questions.Question> Questions => Set<Domain.Questions.Question>();
    public DbSet<Domain.Questions.QuestionVersion> QuestionVersions => Set<Domain.Questions.QuestionVersion>();
    public DbSet<Domain.Questions.QuestionOption> QuestionOptions => Set<Domain.Questions.QuestionOption>();
    public DbSet<Domain.Questions.QuestionTag> QuestionTags => Set<Domain.Questions.QuestionTag>();
    public DbSet<Domain.Questions.QuestionTagLink> QuestionTagLinks => Set<Domain.Questions.QuestionTagLink>();

    // Phase 3 — Quiz Builder & Publishing (Tenant-owned، Global Filters مطلوبة)
    public DbSet<Domain.Quizzes.Quiz> Quizzes => Set<Domain.Quizzes.Quiz>();
    public DbSet<Domain.Quizzes.QuizVersion> QuizVersions => Set<Domain.Quizzes.QuizVersion>();
    public DbSet<Domain.Quizzes.QuizVersionItem> QuizVersionItems => Set<Domain.Quizzes.QuizVersionItem>();

    // Phase 4 — Sessions, Participants, Attempts & Answers (Tenant-owned، Global Filters مطلوبة)
    public DbSet<Domain.Sessions.QuizSession> QuizSessions => Set<Domain.Sessions.QuizSession>();
    public DbSet<Domain.Sessions.SessionParticipant> SessionParticipants => Set<Domain.Sessions.SessionParticipant>();
    public DbSet<Domain.Sessions.Attempt> Attempts => Set<Domain.Sessions.Attempt>();
    public DbSet<Domain.Sessions.AttemptAnswer> AttemptAnswers => Set<Domain.Sessions.AttemptAnswer>();

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

            // Phase 2 — MediaAssets & Question Bank
            modelBuilder.ApplyConfiguration(new Configurations.MediaAssetConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionBankConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionVersionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionOptionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionTagConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuestionTagLinkConfiguration());

            // Phase 3 — Quiz Builder & Publishing
            modelBuilder.ApplyConfiguration(new Configurations.QuizConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuizVersionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuizVersionItemConfiguration());

            // Phase 4 — Sessions, Participants, Attempts & Answers
            modelBuilder.ApplyConfiguration(new Configurations.QuizSessionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SessionParticipantConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.AttemptConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.AttemptAnswerConfiguration());
        }
        else
        {
            modelBuilder.Ignore<Tenant>();
            modelBuilder.Ignore<TenantMembership>();
            modelBuilder.Ignore<TenantSettings>();
            modelBuilder.Ignore<Domain.Media.MediaAsset>();
            modelBuilder.Ignore<Domain.Questions.QuestionBank>();
            modelBuilder.Ignore<Domain.Questions.Question>();
            modelBuilder.Ignore<Domain.Questions.QuestionVersion>();
            modelBuilder.Ignore<Domain.Questions.QuestionOption>();
            modelBuilder.Ignore<Domain.Questions.QuestionTag>();
            modelBuilder.Ignore<Domain.Questions.QuestionTagLink>();
            modelBuilder.Ignore<Domain.Quizzes.Quiz>();
            modelBuilder.Ignore<Domain.Quizzes.QuizVersion>();
            modelBuilder.Ignore<Domain.Quizzes.QuizVersionItem>();
            modelBuilder.Ignore<Domain.Sessions.QuizSession>();
            modelBuilder.Ignore<Domain.Sessions.SessionParticipant>();
            modelBuilder.Ignore<Domain.Sessions.Attempt>();
            modelBuilder.Ignore<Domain.Sessions.AttemptAnswer>();
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
