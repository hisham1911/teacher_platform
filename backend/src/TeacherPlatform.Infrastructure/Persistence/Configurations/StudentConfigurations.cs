using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Students;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.ToTable("Students");
        builder.HasKey(student => student.Id);
        builder.HasAlternateKey(student => new { student.Id, student.TenantId });

        builder.Property(student => student.FullName).HasMaxLength(100).IsRequired();
        builder.Property(student => student.StudentCode).HasMaxLength(12).IsRequired();
        builder.Property(student => student.Grade).HasMaxLength(50);
        builder.Property(student => student.Notes).HasMaxLength(500);
        builder.Property(student => student.IsActive).HasDefaultValue(true);
        builder.Property(student => student.Version).IsRowVersion();

        builder.HasIndex(student => new { student.TenantId, student.StudentCode }).IsUnique();
        builder.HasIndex(student => new { student.TenantId, student.FullName });
        builder.HasIndex(student => new { student.TenantId, student.IsActive });

        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(student => student.TenantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
