using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Media;
using TeacherPlatform.Domain.Questions;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class MediaAssetConfiguration : IEntityTypeConfiguration<MediaAsset>
{
    public void Configure(EntityTypeBuilder<MediaAsset> builder)
    {
        builder.ToTable("MediaAssets");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.ObjectKey).HasMaxLength(500).IsRequired();
        builder.Property(m => m.MimeType).HasMaxLength(100).IsRequired();
        builder.Property(m => m.OriginalFileName).HasMaxLength(260).IsRequired();
        builder.Property(m => m.Kind).HasConversion<int>();
        builder.Property(m => m.Status).HasConversion<int>();

        // مفتاح بديل مركب ليتمكن سؤال من نفس المستأجر فقط من الإشارة للوسيط
        builder.HasAlternateKey(m => new { m.Id, m.TenantId });

        builder.HasIndex(m => m.TenantId);
        builder.HasIndex(m => m.ObjectKey).IsUnique();
    }
}

public sealed class QuestionBankConfiguration : IEntityTypeConfiguration<QuestionBank>
{
    public void Configure(EntityTypeBuilder<QuestionBank> builder)
    {
        builder.ToTable("QuestionBanks");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name).HasMaxLength(120).IsRequired();
        builder.Property(b => b.Description).HasMaxLength(2000);

        // مفتاح بديل مركب ليتمكن Question من نفس المستأجر فقط من الإشارة للبنك
        builder.HasAlternateKey(b => new { b.Id, b.TenantId });

        builder.HasIndex(b => b.TenantId);
    }
}

public sealed class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.ToTable("Questions");
        builder.HasKey(q => q.Id);

        builder.Property(q => q.Status).HasConversion<int>();

        // المفتاح البديل المركب وميناء الصلاحية: يمنع أي FK مركب من تجاوز TenantId
        builder.HasAlternateKey(q => new { q.Id, q.TenantId });

        // Optimistic concurrency على مستوى PostgreSQL row (xmin)
        builder.Property(q => q.Version).IsRowVersion();

        builder.HasIndex(q => new { q.TenantId, q.BankId });

        builder.HasOne(q => q.Bank)
            .WithMany(b => b.Questions)
            .HasForeignKey(q => new { q.BankId, q.TenantId })
            .HasPrincipalKey(b => new { b.Id, b.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class QuestionVersionConfiguration : IEntityTypeConfiguration<QuestionVersion>
{
    public void Configure(EntityTypeBuilder<QuestionVersion> builder)
    {
        builder.ToTable("QuestionVersions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.QuestionType).HasConversion<int>();
        builder.Property(v => v.Difficulty).HasConversion<int>();
        builder.Property(v => v.Prompt).HasMaxLength(2000).IsRequired();
        builder.Property(v => v.Explanation).HasMaxLength(2000);
        builder.Property(v => v.Language).HasMaxLength(10).IsRequired();
        builder.Property(v => v.ConfigJson).HasColumnType("jsonb");

        // المفاتيح البديلة المركبة تمنع ربط نسخة سؤال بمستأجر مختلف (تُشار إليها كPrincipalKey في المركب)
        builder.HasAlternateKey(v => new { v.Id, v.TenantId });
        builder.HasIndex(v => new { v.QuestionId, v.VersionNumber }).IsUnique();
        builder.HasIndex(v => v.TenantId);

        builder.HasOne(v => v.Question)
            .WithMany(q => q.Versions)
            .HasForeignKey(v => new { v.QuestionId, v.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(v => v.MediaAsset)
            .WithMany()
            .HasForeignKey(v => new { v.MediaAssetId, v.TenantId })
            .HasPrincipalKey(m => new { m.Id, m.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class QuestionOptionConfiguration : IEntityTypeConfiguration<QuestionOption>
{
    public void Configure(EntityTypeBuilder<QuestionOption> builder)
    {
        builder.ToTable("QuestionOptions");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.OptionText).HasMaxLength(500).IsRequired();

        // خيار واحد لكل ترتيب داخل النسخة
        builder.HasIndex(o => new { o.QuestionVersionId, o.SortOrder }).IsUnique();

        builder.HasOne(o => o.QuestionVersion)
            .WithMany(v => v.Options)
            .HasForeignKey(o => new { o.QuestionVersionId, o.TenantId })
            .HasPrincipalKey(v => new { v.Id, v.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class QuestionTagConfiguration : IEntityTypeConfiguration<QuestionTag>
{
    public void Configure(EntityTypeBuilder<QuestionTag> builder)
    {
        builder.ToTable("QuestionTags");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).HasMaxLength(60).IsRequired();
        builder.Property(t => t.NormalizedName).HasMaxLength(60).IsRequired();

        // مفتاح بديل مركب لضمان أن Link يشير فقط لوسم من نفس المستأجر
        builder.HasAlternateKey(t => new { t.Id, t.TenantId });

        builder.HasIndex(t => new { t.TenantId, t.NormalizedName }).IsUnique();
    }
}

public sealed class QuestionTagLinkConfiguration : IEntityTypeConfiguration<QuestionTagLink>
{
    public void Configure(EntityTypeBuilder<QuestionTagLink> builder)
    {
        builder.ToTable("QuestionTagLinks");
        builder.HasKey(l => new { l.QuestionId, l.TagId });

        builder.HasOne(l => l.Question)
            .WithMany(q => q.TagLinks)
            .HasForeignKey(l => new { l.QuestionId, l.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(l => l.Tag)
            .WithMany(t => t.QuestionLinks)
            .HasForeignKey(l => new { l.TagId, l.TenantId })
            .HasPrincipalKey(t => new { t.Id, t.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
