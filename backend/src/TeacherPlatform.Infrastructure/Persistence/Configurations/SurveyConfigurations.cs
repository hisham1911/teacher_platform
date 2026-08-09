using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Surveys;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class SurveyConfiguration : IEntityTypeConfiguration<Survey>
{
    public void Configure(EntityTypeBuilder<Survey> builder)
    {
        builder.ToTable("Surveys");
        builder.HasKey(s => s.Id);
        builder.HasAlternateKey(s => new { s.Id, s.TenantId });

        builder.Property(s => s.Title).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(2000);
        builder.Property(s => s.Status).HasConversion<int>();
        builder.Property(s => s.Version).IsRowVersion();

        builder.HasIndex(s => new { s.TenantId, s.QuizId }).IsUnique();
        builder.HasIndex(s => new { s.TenantId, s.Status });

        builder.HasOne(s => s.Quiz)
            .WithMany()
            .HasForeignKey(s => new { s.QuizId, s.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class SurveyQuestionConfiguration : IEntityTypeConfiguration<SurveyQuestion>
{
    public void Configure(EntityTypeBuilder<SurveyQuestion> builder)
    {
        builder.ToTable("SurveyQuestions");
        builder.HasKey(q => q.Id);
        builder.HasAlternateKey(q => new { q.Id, q.TenantId });

        builder.Property(q => q.QuestionType).HasConversion<int>();
        builder.Property(q => q.Prompt).HasMaxLength(500).IsRequired();

        builder.HasIndex(q => new { q.SurveyId, q.SortOrder }).IsUnique();
        builder.HasIndex(q => q.TenantId);

        builder.HasOne(q => q.Survey)
            .WithMany(s => s.Questions)
            .HasForeignKey(q => new { q.SurveyId, q.TenantId })
            .HasPrincipalKey(s => new { s.Id, s.TenantId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SurveyOptionConfiguration : IEntityTypeConfiguration<SurveyOption>
{
    public void Configure(EntityTypeBuilder<SurveyOption> builder)
    {
        builder.ToTable("SurveyOptions");
        builder.HasKey(o => o.Id);
        builder.HasAlternateKey(o => new { o.Id, o.SurveyQuestionId, o.TenantId });

        builder.Property(o => o.OptionText).HasMaxLength(200).IsRequired();

        builder.HasIndex(o => new { o.SurveyQuestionId, o.SortOrder }).IsUnique();
        builder.HasIndex(o => o.TenantId);

        builder.HasOne(o => o.Question)
            .WithMany(q => q.Options)
            .HasForeignKey(o => new { o.SurveyQuestionId, o.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SurveyResponseConfiguration : IEntityTypeConfiguration<SurveyResponse>
{
    public void Configure(EntityTypeBuilder<SurveyResponse> builder)
    {
        builder.ToTable("SurveyResponses");
        builder.HasKey(r => r.Id);
        builder.HasAlternateKey(r => new { r.Id, r.TenantId });

        builder.HasIndex(r => new { r.SurveyId, r.AttemptId }).IsUnique();
        builder.HasIndex(r => r.TenantId);

        builder.HasOne(r => r.Survey)
            .WithMany(s => s.Responses)
            .HasForeignKey(r => new { r.SurveyId, r.TenantId })
            .HasPrincipalKey(s => new { s.Id, s.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(r => r.Attempt)
            .WithMany()
            .HasForeignKey(r => new { r.AttemptId, r.TenantId })
            .HasPrincipalKey(a => new { a.Id, a.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class SurveyAnswerConfiguration : IEntityTypeConfiguration<SurveyAnswer>
{
    public void Configure(EntityTypeBuilder<SurveyAnswer> builder)
    {
        builder.ToTable("SurveyAnswers");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.TextValue).HasMaxLength(1000);

        builder.HasIndex(a => new { a.SurveyResponseId, a.SurveyQuestionId }).IsUnique();
        builder.HasIndex(a => a.TenantId);

        builder.HasOne(a => a.Response)
            .WithMany(r => r.Answers)
            .HasForeignKey(a => new { a.SurveyResponseId, a.TenantId })
            .HasPrincipalKey(r => new { r.Id, r.TenantId })
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Question)
            .WithMany(q => q.Answers)
            .HasForeignKey(a => new { a.SurveyQuestionId, a.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(a => a.SelectedOption)
            .WithMany()
            .HasForeignKey(a => new { a.SelectedOptionId, a.SurveyQuestionId, a.TenantId })
            .HasPrincipalKey(o => new { o.Id, o.SurveyQuestionId, o.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
