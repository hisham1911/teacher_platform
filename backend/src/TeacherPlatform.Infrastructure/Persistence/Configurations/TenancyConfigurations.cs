using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("Tenants");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).HasMaxLength(120).IsRequired();
        builder.Property(t => t.Slug).HasMaxLength(40).IsRequired();
        builder.Property(t => t.NormalizedSlug).HasMaxLength(40).IsRequired();
        builder.Property(t => t.CountryCode).HasMaxLength(2).IsRequired();
        builder.Property(t => t.Timezone).HasMaxLength(40).IsRequired();
        builder.Property(t => t.DefaultLocale).HasMaxLength(10).IsRequired();
        builder.Property(t => t.Status).HasConversion<int>();

        builder.HasIndex(t => t.NormalizedSlug).IsUnique();
    }
}

public sealed class TenantMembershipConfiguration : IEntityTypeConfiguration<TenantMembership>
{
    public void Configure(EntityTypeBuilder<TenantMembership> builder)
    {
        builder.ToTable("TenantMemberships");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Role).HasConversion<int>();
        builder.Property(m => m.Status).HasConversion<int>();

        builder.HasIndex(m => new { m.TenantId, m.UserId }).IsUnique();
        builder.HasIndex(m => m.UserId);

        builder.HasOne(m => m.Tenant)
            .WithMany(t => t.Memberships)
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("TenantSettings");
        builder.HasKey(s => s.TenantId);

        builder.Property(s => s.LogoObjectKey).HasMaxLength(500);
        builder.Property(s => s.PrimaryColor).HasMaxLength(9);
        builder.Property(s => s.SecondaryColor).HasMaxLength(9);
        builder.Property(s => s.PublicTeacherName).HasMaxLength(120);
        builder.Property(s => s.CertificateSignatureObjectKey).HasMaxLength(500);
        builder.Property(s => s.SettingsJson).HasColumnType("jsonb");

        builder.HasOne(s => s.Tenant)
            .WithOne(t => t.Settings)
            .HasForeignKey<TenantSettings>(s => s.TenantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

