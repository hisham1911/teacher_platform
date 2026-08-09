using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Saas;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public void Configure(EntityTypeBuilder<Plan> builder)
    {
        builder.ToTable("Plans");
        builder.HasKey(plan => plan.Id);
        builder.Property(plan => plan.Code).HasMaxLength(40).IsRequired();
        builder.Property(plan => plan.Name).HasMaxLength(120).IsRequired();
        builder.Property(plan => plan.LimitsJson).HasColumnType("jsonb");
        builder.Property(plan => plan.Version).IsRowVersion();
        builder.HasIndex(plan => plan.Code).IsUnique();
    }
}

public sealed class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.ToTable("Subscriptions");
        builder.HasKey(subscription => subscription.Id);
        builder.HasAlternateKey(subscription => new { subscription.Id, subscription.TenantId });
        builder.Property(subscription => subscription.Status).HasConversion<int>();
        builder.Property(subscription => subscription.PaymentProvider).HasMaxLength(80);
        builder.Property(subscription => subscription.ExternalReference).HasMaxLength(200);
        builder.HasIndex(subscription => new { subscription.TenantId, subscription.Status });
        builder.HasIndex(subscription => subscription.TenantId)
            .IsUnique()
            .HasFilter("\"Status\" = 1");
        builder.HasOne(subscription => subscription.Plan)
            .WithMany(plan => plan.Subscriptions)
            .HasForeignKey(subscription => subscription.PlanId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class UsageCounterConfiguration : IEntityTypeConfiguration<UsageCounter>
{
    public void Configure(EntityTypeBuilder<UsageCounter> builder)
    {
        builder.ToTable("UsageCounters");
        builder.HasKey(counter => counter.Id);
        builder.HasAlternateKey(counter => new { counter.Id, counter.TenantId });
        builder.Property(counter => counter.Metric).HasMaxLength(64).IsRequired();
        builder.HasIndex(counter => new { counter.TenantId, counter.PeriodStart, counter.Metric }).IsUnique();
    }
}

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");
        builder.HasKey(log => log.Id);
        builder.Property(log => log.Action).HasMaxLength(120).IsRequired();
        builder.Property(log => log.EntityType).HasMaxLength(120).IsRequired();
        builder.Property(log => log.EntityId).HasMaxLength(120);
        builder.Property(log => log.MetadataJson).HasColumnType("jsonb");
        builder.Property(log => log.RequestId).HasMaxLength(100);
        builder.HasIndex(log => new { log.TenantId, log.CreatedAt });
        builder.HasIndex(log => new { log.ActorUserId, log.CreatedAt });
    }
}

public sealed class ReferralCodeConfiguration : IEntityTypeConfiguration<ReferralCode>
{
    public void Configure(EntityTypeBuilder<ReferralCode> builder)
    {
        builder.ToTable("ReferralCodes");
        builder.HasKey(code => code.Id);
        builder.HasAlternateKey(code => new { code.Id, code.TenantId });
        builder.Property(code => code.Code).HasMaxLength(24).IsRequired();
        builder.HasIndex(code => code.Code).IsUnique();
        builder.HasIndex(code => code.TenantId).IsUnique();
    }
}

public sealed class ReferralEventConfiguration : IEntityTypeConfiguration<ReferralEvent>
{
    public void Configure(EntityTypeBuilder<ReferralEvent> builder)
    {
        builder.ToTable("ReferralEvents");
        builder.HasKey(@event => @event.Id);
        builder.Property(@event => @event.EventType).HasMaxLength(80).IsRequired();
        builder.HasIndex(@event => new { @event.TenantId, @event.ReferralCodeId, @event.OccurredAt });
        builder.HasOne(@event => @event.ReferralCode)
            .WithMany(code => code.Events)
            .HasForeignKey(@event => new { @event.ReferralCodeId, @event.TenantId })
            .HasPrincipalKey(code => new { code.Id, code.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
