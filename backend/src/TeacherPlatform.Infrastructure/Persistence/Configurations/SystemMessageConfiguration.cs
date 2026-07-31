using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Metadata;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class SystemMessageConfiguration : IEntityTypeConfiguration<SystemMessage>
{
    public void Configure(EntityTypeBuilder<SystemMessage> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Code).HasMaxLength(64).IsRequired();
        builder.Property(e => e.Message).HasMaxLength(512).IsRequired();
        builder.HasIndex(e => e.Code).IsUnique();
    }
}
