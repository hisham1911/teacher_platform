using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Quizzes;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> builder)
    {
        builder.ToTable("Quizzes");
        builder.HasKey(q => q.Id);

        builder.Property(q => q.Title).HasMaxLength(200).IsRequired();
        builder.Property(q => q.Slug).HasMaxLength(120).IsRequired();
        builder.Property(q => q.NormalizedSlug).HasMaxLength(120).IsRequired();
        builder.Property(q => q.Description).HasMaxLength(2000);
        builder.Property(q => q.PublicCode).HasMaxLength(32).IsRequired();
        builder.Property(q => q.Status).HasConversion<int>();

        // مفتاح بديل مركب: يمنع أي FK مركب من تجاوز TenantId
        builder.HasAlternateKey(q => new { q.Id, q.TenantId });

        // Optimistic concurrency على مستوى PostgreSQL row (xmin)
        builder.Property(q => q.Version).IsRowVersion();

        builder.HasIndex(q => new { q.TenantId, q.NormalizedSlug }).IsUnique();
        builder.HasIndex(q => new { q.TenantId, q.PublicCode }).IsUnique();
        builder.HasIndex(q => q.TenantId);
    }
}

public sealed class QuizVersionConfiguration : IEntityTypeConfiguration<QuizVersion>
{
    public void Configure(EntityTypeBuilder<QuizVersion> builder)
    {
        builder.ToTable("QuizVersions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Status).HasConversion<int>();
        builder.Property(v => v.TimeMode).HasConversion<int>();
        builder.Property(v => v.TitleSnapshot).HasMaxLength(200).IsRequired();
        builder.Property(v => v.DescriptionSnapshot).HasMaxLength(2000);
        builder.Property(v => v.InstructionsSnapshot).HasMaxLength(4000);
        builder.Property(v => v.ThemeJson).HasColumnType("jsonb");
        builder.Property(v => v.Checksum).HasMaxLength(64);

        // مفتاح بديل مركب ليتمكن QuizVersionItem من نفس المستأجر فقط من الإشارة للنسخة
        builder.HasAlternateKey(v => new { v.Id, v.TenantId });

        builder.Property(v => v.Version).IsRowVersion();

        builder.HasIndex(v => new { v.QuizId, v.VersionNumber }).IsUnique();
        builder.HasIndex(v => v.TenantId);

        builder.HasOne(v => v.Quiz)
            .WithMany(q => q.Versions)
            .HasForeignKey(v => new { v.QuizId, v.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class QuizVersionItemConfiguration : IEntityTypeConfiguration<QuizVersionItem>
{
    public void Configure(EntityTypeBuilder<QuizVersionItem> builder)
    {
        builder.ToTable("QuizVersionItems");
        builder.HasKey(i => i.Id);

        // عنصر واحد لكل ترتيب داخل النسخة
        builder.HasIndex(i => new { i.QuizVersionId, i.SortOrder }).IsUnique();

        // لا تكرار لنفس نسخة السؤال داخل نسخة الاختبار
        builder.HasIndex(i => new { i.QuizVersionId, i.QuestionVersionId }).IsUnique();

        builder.HasIndex(i => i.TenantId);

        builder.HasOne(i => i.QuizVersion)
            .WithMany(v => v.Items)
            .HasForeignKey(i => new { i.QuizVersionId, i.TenantId })
            .HasPrincipalKey(v => new { v.Id, v.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(i => i.QuestionVersion)
            .WithMany()
            .HasForeignKey(i => new { i.QuestionVersionId, i.TenantId })
            .HasPrincipalKey(v => new { v.Id, v.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
