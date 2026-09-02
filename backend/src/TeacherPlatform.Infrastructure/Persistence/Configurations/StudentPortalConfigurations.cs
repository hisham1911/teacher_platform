using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Students;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class StudentPortalCredentialConfiguration : IEntityTypeConfiguration<StudentPortalCredential>
{
    public void Configure(EntityTypeBuilder<StudentPortalCredential> builder)
    {
        builder.ToTable("StudentPortalCredentials");
        builder.HasKey(item => item.Id);
        builder.HasAlternateKey(item => new { item.Id, item.TenantId });

        builder.Property(item => item.LookupDigest).HasMaxLength(64).IsRequired();
        builder.Property(item => item.VerifierHash).HasMaxLength(512).IsRequired();
        builder.Property(item => item.CodeSuffix).HasMaxLength(4).IsRequired();

        // Access codes are globally resolvable without asking a student to choose a workspace first.
        builder.HasIndex(item => item.LookupDigest).IsUnique();
        builder.HasIndex(item => new { item.TenantId, item.StudentId })
            .IsUnique()
            .HasFilter("\"RevokedAt\" IS NULL");

        builder.HasOne(item => item.Student)
            .WithMany(student => student.PortalCredentials)
            .HasForeignKey(item => new { item.StudentId, item.TenantId })
            .HasPrincipalKey(student => new { student.Id, student.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class StudentPortalSessionConfiguration : IEntityTypeConfiguration<StudentPortalSession>
{
    public void Configure(EntityTypeBuilder<StudentPortalSession> builder)
    {
        builder.ToTable("StudentPortalSessions");
        builder.HasKey(item => item.Id);

        builder.Property(item => item.TokenHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(item => item.TokenHash).IsUnique();
        builder.HasIndex(item => new { item.TenantId, item.StudentId, item.RevokedAt });
        builder.HasIndex(item => item.ExpiresAt);

        builder.HasOne(item => item.Student)
            .WithMany(student => student.PortalSessions)
            .HasForeignKey(item => new { item.StudentId, item.TenantId })
            .HasPrincipalKey(student => new { student.Id, student.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(item => item.Credential)
            .WithMany(credential => credential.Sessions)
            .HasForeignKey(item => new { item.CredentialId, item.TenantId })
            .HasPrincipalKey(credential => new { credential.Id, credential.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
