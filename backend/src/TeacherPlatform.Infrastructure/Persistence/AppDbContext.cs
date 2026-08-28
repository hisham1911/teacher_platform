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
/// </summary>
public class AppDbContext(
    DbContextOptions<AppDbContext> options,
    ITenantContext tenantContext)
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options)
{
    private readonly ITenantContext _tenantContext = tenantContext;

    public Guid? CurrentTenantId => _tenantContext.TenantId;

    public DbSet<SystemMessage> SystemMessages => Set<SystemMessage>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Phase 2 — MediaAssets & Question Bank
    public DbSet<Domain.Media.MediaAsset> MediaAssets => Set<Domain.Media.MediaAsset>();
    public DbSet<Domain.Questions.QuestionBank> QuestionBanks => Set<Domain.Questions.QuestionBank>();
    public DbSet<Domain.Questions.Question> Questions => Set<Domain.Questions.Question>();
    public DbSet<Domain.Questions.QuestionVersion> QuestionVersions => Set<Domain.Questions.QuestionVersion>();
    public DbSet<Domain.Questions.QuestionOption> QuestionOptions => Set<Domain.Questions.QuestionOption>();
    public DbSet<Domain.Questions.QuestionTag> QuestionTags => Set<Domain.Questions.QuestionTag>();
    public DbSet<Domain.Questions.QuestionTagLink> QuestionTagLinks => Set<Domain.Questions.QuestionTagLink>();

    // Phase 3 — Quiz Builder & Publishing
    public DbSet<Domain.Quizzes.Quiz> Quizzes => Set<Domain.Quizzes.Quiz>();
    public DbSet<Domain.Quizzes.QuizVersion> QuizVersions => Set<Domain.Quizzes.QuizVersion>();
    public DbSet<Domain.Quizzes.QuizVersionItem> QuizVersionItems => Set<Domain.Quizzes.QuizVersionItem>();

    // Phase 4 — Student roster, Sessions, Participants, Attempts & Answers
    public DbSet<Domain.Students.Student> Students => Set<Domain.Students.Student>();
    public DbSet<Domain.Sessions.QuizSession> QuizSessions => Set<Domain.Sessions.QuizSession>();
    public DbSet<Domain.Sessions.SessionParticipant> SessionParticipants => Set<Domain.Sessions.SessionParticipant>();
    public DbSet<Domain.Sessions.Attempt> Attempts => Set<Domain.Sessions.Attempt>();
    public DbSet<Domain.Sessions.AttemptAnswer> AttemptAnswers => Set<Domain.Sessions.AttemptAnswer>();
    public DbSet<Domain.Sessions.LiveSessionState> LiveSessionStates => Set<Domain.Sessions.LiveSessionState>();

    // Phase 7 — SaaS administration and operations
    public DbSet<Domain.Saas.Plan> Plans => Set<Domain.Saas.Plan>();
    public DbSet<Domain.Saas.Subscription> Subscriptions => Set<Domain.Saas.Subscription>();
    public DbSet<Domain.Saas.UsageCounter> UsageCounters => Set<Domain.Saas.UsageCounter>();
    public DbSet<Domain.Saas.AuditLog> AuditLogs => Set<Domain.Saas.AuditLog>();
    public DbSet<Domain.Saas.ReferralCode> ReferralCodes => Set<Domain.Saas.ReferralCode>();
    public DbSet<Domain.Saas.ReferralEvent> ReferralEvents => Set<Domain.Saas.ReferralEvent>();

    // Phase 5 — Surveys
    public DbSet<Domain.Surveys.Survey> Surveys => Set<Domain.Surveys.Survey>();
    public DbSet<Domain.Surveys.SurveyQuestion> SurveyQuestions => Set<Domain.Surveys.SurveyQuestion>();
    public DbSet<Domain.Surveys.SurveyOption> SurveyOptions => Set<Domain.Surveys.SurveyOption>();
    public DbSet<Domain.Surveys.SurveyResponse> SurveyResponses => Set<Domain.Surveys.SurveyResponse>();
    public DbSet<Domain.Surveys.SurveyAnswer> SurveyAnswers => Set<Domain.Surveys.SurveyAnswer>();

    // Phase 5 — Certificates, parent sharing & Outbox
    public DbSet<Domain.Certificates.CertificateTemplate> CertificateTemplates => Set<Domain.Certificates.CertificateTemplate>();
    public DbSet<Domain.Certificates.Certificate> Certificates => Set<Domain.Certificates.Certificate>();
    public DbSet<Domain.Certificates.ParentResultShare> ParentResultShares => Set<Domain.Certificates.ParentResultShare>();
    public DbSet<Domain.Operations.OutboxMessage> OutboxMessages => Set<Domain.Operations.OutboxMessage>();

    private DbSet<Tenant>? _tenants;
    private DbSet<TenantMembership>? _tenantMemberships;
    private DbSet<TenantSettings>? _tenantSettings;

    public DbSet<Tenant> Tenants => GetTenancySet(ref _tenants);
    public DbSet<TenantMembership> TenantMemberships => GetTenancySet(ref _tenantMemberships);
    public DbSet<TenantSettings> TenantSettings => GetTenancySet(ref _tenantSettings);

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

            // Phase 4 — Student roster, Sessions, Participants, Attempts & Answers
            modelBuilder.ApplyConfiguration(new Configurations.StudentConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.QuizSessionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SessionParticipantConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.AttemptConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.AttemptAnswerConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.LiveSessionStateConfiguration());

            // Phase 7 — SaaS administration
            modelBuilder.ApplyConfiguration(new Configurations.PlanConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SubscriptionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.UsageCounterConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.AuditLogConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.ReferralCodeConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.ReferralEventConfiguration());

            // Phase 5 — Surveys
            modelBuilder.ApplyConfiguration(new Configurations.SurveyConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SurveyQuestionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SurveyOptionConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SurveyResponseConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.SurveyAnswerConfiguration());

            // Phase 5 — Certificates, parent sharing & Outbox
            modelBuilder.ApplyConfiguration(new Configurations.CertificateTemplateConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.CertificateConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.ParentResultShareConfiguration());
            modelBuilder.ApplyConfiguration(new Configurations.OutboxMessageConfiguration());
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
            modelBuilder.Ignore<Domain.Students.Student>();
            modelBuilder.Ignore<Domain.Sessions.QuizSession>();
            modelBuilder.Ignore<Domain.Sessions.SessionParticipant>();
            modelBuilder.Ignore<Domain.Sessions.Attempt>();
            modelBuilder.Ignore<Domain.Sessions.AttemptAnswer>();
            modelBuilder.Ignore<Domain.Sessions.LiveSessionState>();
            modelBuilder.Ignore<Domain.Saas.Plan>();
            modelBuilder.Ignore<Domain.Saas.Subscription>();
            modelBuilder.Ignore<Domain.Saas.UsageCounter>();
            modelBuilder.Ignore<Domain.Saas.AuditLog>();
            modelBuilder.Ignore<Domain.Saas.ReferralCode>();
            modelBuilder.Ignore<Domain.Saas.ReferralEvent>();
            modelBuilder.Ignore<Domain.Surveys.Survey>();
            modelBuilder.Ignore<Domain.Surveys.SurveyQuestion>();
            modelBuilder.Ignore<Domain.Surveys.SurveyOption>();
            modelBuilder.Ignore<Domain.Surveys.SurveyResponse>();
            modelBuilder.Ignore<Domain.Surveys.SurveyAnswer>();
            modelBuilder.Ignore<Domain.Certificates.CertificateTemplate>();
            modelBuilder.Ignore<Domain.Certificates.Certificate>();
            modelBuilder.Ignore<Domain.Certificates.ParentResultShare>();
            modelBuilder.Ignore<Domain.Operations.OutboxMessage>();
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

            var filter = TenantQueryFilterConvention.BuildTenantFilter(entityType.ClrType, this);
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
