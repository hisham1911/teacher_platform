using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Sessions;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class QuizSessionConfiguration : IEntityTypeConfiguration<QuizSession>
{
    public void Configure(EntityTypeBuilder<QuizSession> builder)
    {
        builder.ToTable("QuizSessions");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.JoinCode).HasMaxLength(32).IsRequired();
        builder.Property(s => s.Label).HasMaxLength(200);
        builder.Property(s => s.Mode).HasConversion<int>();
        builder.Property(s => s.Status).HasConversion<int>();

        // مفتاح بديل مركب: يمنع أي FK مركب من تجاوز TenantId
        builder.HasAlternateKey(s => new { s.Id, s.TenantId });

        builder.Property(s => s.Version).IsRowVersion();

        // JoinCode فريد عالمياً (ليس لكل مستأجر) — يجب أن يكون غير قابل للتخمين
        builder.HasIndex(s => s.JoinCode).IsUnique();
        builder.HasIndex(s => s.TenantId);
        builder.HasIndex(s => new { s.TenantId, s.QuizId });
        builder.HasIndex(s => new { s.TenantId, s.Status });

        builder.HasOne(s => s.Quiz)
            .WithMany()
            .HasForeignKey(s => new { s.QuizId, s.TenantId })
            .HasPrincipalKey(q => new { q.Id, q.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(s => s.QuizVersion)
            .WithMany()
            .HasForeignKey(s => new { s.QuizVersionId, s.TenantId })
            .HasPrincipalKey(v => new { v.Id, v.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class SessionParticipantConfiguration : IEntityTypeConfiguration<SessionParticipant>
{
    public void Configure(EntityTypeBuilder<SessionParticipant> builder)
    {
        builder.ToTable("SessionParticipants");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.DisplayName).HasMaxLength(50).IsRequired();
        builder.Property(p => p.GuestTokenHash).HasMaxLength(64).IsRequired();

        builder.HasAlternateKey(p => new { p.Id, p.TenantId });

        builder.HasIndex(p => p.TenantId);
        builder.HasIndex(p => new { p.SessionId, p.TenantId });
        builder.HasIndex(p => p.GuestTokenHash);

        builder.HasOne(p => p.Session)
            .WithMany(s => s.Participants)
            .HasForeignKey(p => new { p.SessionId, p.TenantId })
            .HasPrincipalKey(s => new { s.Id, s.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class AttemptConfiguration : IEntityTypeConfiguration<Attempt>
{
    public void Configure(EntityTypeBuilder<Attempt> builder)
    {
        builder.ToTable("Attempts");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Status).HasConversion<int>();
        builder.Property(a => a.Score).HasPrecision(10, 2);
        builder.Property(a => a.MaxScore).HasPrecision(10, 2);
        builder.Property(a => a.Percentage).HasPrecision(5, 2);

        builder.HasAlternateKey(a => new { a.Id, a.TenantId });

        builder.Property(a => a.Version).IsRowVersion();

        // محاولة واحدة فقط لكل مشارك في كل جلسة
        builder.HasIndex(a => new { a.SessionId, a.ParticipantId }).IsUnique();
        builder.HasIndex(a => a.TenantId);
        builder.HasIndex(a => new { a.SessionId, a.TenantId });

        builder.HasOne(a => a.Session)
            .WithMany(s => s.Attempts)
            .HasForeignKey(a => new { a.SessionId, a.TenantId })
            .HasPrincipalKey(s => new { s.Id, s.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(a => a.Participant)
            .WithOne(p => p.Attempt)
            .HasForeignKey<Attempt>(a => new { a.ParticipantId, a.TenantId })
            .HasPrincipalKey<SessionParticipant>(p => new { p.Id, p.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class AttemptAnswerConfiguration : IEntityTypeConfiguration<AttemptAnswer>
{
    public void Configure(EntityTypeBuilder<AttemptAnswer> builder)
    {
        builder.ToTable("AttemptAnswers");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.AnswerJson).HasColumnType("jsonb");
        builder.Property(a => a.ScoreAwarded).HasPrecision(10, 2);

        builder.HasAlternateKey(a => new { a.Id, a.TenantId });

        // إجابة واحدة فقط لكل عنصر في كل محاولة
        builder.HasIndex(a => new { a.AttemptId, a.QuizVersionItemId }).IsUnique();
        builder.HasIndex(a => a.TenantId);
        builder.HasIndex(a => new { a.AttemptId, a.TenantId });

        builder.HasOne(a => a.Attempt)
            .WithMany(at => at.Answers)
            .HasForeignKey(a => new { a.AttemptId, a.TenantId })
            .HasPrincipalKey(at => new { at.Id, at.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        // FK مركب إلى QuizVersionItem — يضمن أن العنصر من نفس المستأجر
        builder.HasOne<Domain.Quizzes.QuizVersionItem>()
            .WithMany()
            .HasForeignKey(a => new { a.QuizVersionItemId, a.TenantId })
            .HasPrincipalKey(i => new { i.Id, i.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class LiveSessionStateConfiguration : IEntityTypeConfiguration<LiveSessionState>
{
    public void Configure(EntityTypeBuilder<LiveSessionState> builder)
    {
        builder.ToTable("LiveSessionStates");
        builder.HasKey(state => state.Id);
        builder.HasAlternateKey(state => new { state.Id, state.TenantId });
        builder.Property(state => state.Phase).HasConversion<int>();
        builder.Property(state => state.Version).IsRowVersion();

        builder.HasIndex(state => state.SessionId).IsUnique();
        builder.HasIndex(state => new { state.TenantId, state.Phase });
        builder.HasIndex(state => new { state.Phase, state.QuestionClosesAt });

        builder.HasOne(state => state.Session)
            .WithOne(session => session.LiveState)
            .HasForeignKey<LiveSessionState>(state => new { state.SessionId, state.TenantId })
            .HasPrincipalKey<QuizSession>(session => new { session.Id, session.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(state => state.CurrentQuizVersionItem)
            .WithMany()
            .HasForeignKey(state => new { state.CurrentQuizVersionItemId, state.TenantId })
            .HasPrincipalKey(item => new { item.Id, item.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
