using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Operations;
using TeacherPlatform.Domain.Sessions;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class CertificateTemplateConfiguration : IEntityTypeConfiguration<CertificateTemplate>
{
    public void Configure(EntityTypeBuilder<CertificateTemplate> builder)
    {
        builder.ToTable("CertificateTemplates");
        builder.HasKey(template => template.Id);
        builder.HasAlternateKey(template => new { template.Id, template.TenantId });
        builder.Property(template => template.Name).HasMaxLength(120);
        builder.Property(template => template.TitleText).HasMaxLength(200);
        builder.Property(template => template.BodyText).HasMaxLength(500);
        builder.Property(template => template.IssuerName).HasMaxLength(200);
        builder.Property(template => template.PrimaryColor).HasMaxLength(7);
        builder.Property(template => template.SecondaryColor).HasMaxLength(7);
        builder.Property(template => template.Version).IsRowVersion();
        builder.HasIndex(template => template.TenantId);
        builder.HasIndex(template => new { template.TenantId, template.Name }).IsUnique();
        builder.HasIndex(template => template.TenantId)
            .IsUnique()
            .HasFilter("\"IsDefault\" = TRUE");
    }
}

public sealed class CertificateConfiguration : IEntityTypeConfiguration<Certificate>
{
    public void Configure(EntityTypeBuilder<Certificate> builder)
    {
        builder.ToTable("Certificates");
        builder.HasKey(certificate => certificate.Id);
        builder.HasAlternateKey(certificate => new { certificate.Id, certificate.TenantId });
        builder.Property(certificate => certificate.CertificateNumber).HasMaxLength(40);
        builder.Property(certificate => certificate.PublicTokenHash).HasMaxLength(64);
        builder.Property(certificate => certificate.PublicTokenProtected).HasMaxLength(1000);
        builder.Property(certificate => certificate.Status).HasConversion<int>();
        builder.Property(certificate => certificate.StudentName).HasMaxLength(50);
        builder.Property(certificate => certificate.QuizTitle).HasMaxLength(200);
        builder.Property(certificate => certificate.Percentage).HasPrecision(5, 2);
        builder.Property(certificate => certificate.TitleText).HasMaxLength(200);
        builder.Property(certificate => certificate.BodyText).HasMaxLength(500);
        builder.Property(certificate => certificate.IssuerName).HasMaxLength(200);
        builder.Property(certificate => certificate.PrimaryColor).HasMaxLength(7);
        builder.Property(certificate => certificate.SecondaryColor).HasMaxLength(7);
        builder.Property(certificate => certificate.FileObjectKey).HasMaxLength(500);
        builder.Property(certificate => certificate.FailureReason).HasMaxLength(500);
        builder.HasIndex(certificate => new { certificate.TenantId, certificate.CertificateNumber }).IsUnique();
        builder.HasIndex(certificate => certificate.PublicTokenHash).IsUnique();
        builder.HasIndex(certificate => new { certificate.TenantId, certificate.Status });

        builder.HasOne(certificate => certificate.Attempt)
            .WithOne()
            .HasForeignKey<Certificate>(certificate => new { certificate.AttemptId, certificate.TenantId })
            .HasPrincipalKey<Attempt>(attempt => new { attempt.Id, attempt.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(certificate => certificate.Template)
            .WithMany(template => template.Certificates)
            .HasForeignKey(certificate => new { certificate.TemplateId, certificate.TenantId })
            .HasPrincipalKey(template => new { template.Id, template.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ParentResultShareConfiguration : IEntityTypeConfiguration<ParentResultShare>
{
    public void Configure(EntityTypeBuilder<ParentResultShare> builder)
    {
        builder.ToTable("ParentResultShares");
        builder.HasKey(share => share.Id);
        builder.Property(share => share.TokenHash).HasMaxLength(64);
        builder.HasIndex(share => share.TokenHash).IsUnique();
        builder.HasIndex(share => share.ExpiresAt);
        builder.HasOne(share => share.Attempt)
            .WithMany()
            .HasForeignKey(share => new { share.AttemptId, share.TenantId })
            .HasPrincipalKey(attempt => new { attempt.Id, attempt.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("OutboxMessages");
        builder.HasKey(message => message.Id);
        builder.Property(message => message.MessageType).HasMaxLength(120);
        builder.Property(message => message.PayloadJson).HasColumnType("jsonb");
        builder.Property(message => message.LockOwner).HasMaxLength(100);
        builder.Property(message => message.LastError).HasMaxLength(1000);
        builder.HasIndex(message => new { message.ProcessedAt, message.NextAttemptAt });
        builder.HasIndex(message => new { message.LockedUntil, message.NextAttemptAt });
        builder.HasIndex(message => new { message.TenantId, message.MessageType });
        builder.HasIndex(message => new { message.TenantId, message.MessageType, message.AggregateId });
    }
}
