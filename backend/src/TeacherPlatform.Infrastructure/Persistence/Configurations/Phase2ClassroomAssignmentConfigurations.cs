using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeacherPlatform.Domain.Assignments;
using TeacherPlatform.Domain.Classrooms;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Students;

namespace TeacherPlatform.Infrastructure.Persistence.Configurations;

public sealed class ClassroomConfiguration : IEntityTypeConfiguration<Classroom>
{
    public void Configure(EntityTypeBuilder<Classroom> builder)
    {
        builder.ToTable("Classrooms");
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.TenantId });
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.AcademicYear).HasMaxLength(30);
        builder.Property(x => x.IsActive).HasDefaultValue(true);
        builder.Property(x => x.Version).IsRowVersion();
        builder.HasIndex(x => new { x.TenantId, x.Name });
        builder.HasIndex(x => new { x.TenantId, x.IsActive });
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ClassroomStudentConfiguration : IEntityTypeConfiguration<ClassroomStudent>
{
    public void Configure(EntityTypeBuilder<ClassroomStudent> builder)
    {
        builder.ToTable("ClassroomStudents");
        builder.HasKey(x => new { x.ClassroomId, x.StudentId });
        builder.HasIndex(x => new { x.TenantId, x.StudentId });
        builder.HasIndex(x => new { x.TenantId, x.ClassroomId });

        builder.HasOne(x => x.Classroom)
            .WithMany(x => x.Students)
            .HasForeignKey(x => new { x.ClassroomId, x.TenantId })
            .HasPrincipalKey(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.Student)
            .WithMany()
            .HasForeignKey(x => new { x.StudentId, x.TenantId })
            .HasPrincipalKey(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class AssignmentConfiguration : IEntityTypeConfiguration<Assignment>
{
    public void Configure(EntityTypeBuilder<Assignment> builder)
    {
        builder.ToTable("Assignments");
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.TenantId });
        builder.Property(x => x.Version).IsRowVersion();
        builder.HasIndex(x => x.SessionId).IsUnique();
        builder.HasIndex(x => new { x.TenantId, x.QuizVersionId });
        builder.HasIndex(x => new { x.TenantId, x.AvailableAt });
        builder.HasIndex(x => new { x.TenantId, x.DueAt });

        builder.HasOne(x => x.QuizVersion)
            .WithMany()
            .HasForeignKey(x => new { x.QuizVersionId, x.TenantId })
            .HasPrincipalKey<QuizVersion>(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.Session)
            .WithOne()
            .HasForeignKey<Assignment>(x => new { x.SessionId, x.TenantId })
            .HasPrincipalKey<QuizSession>(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class AssignmentRecipientConfiguration : IEntityTypeConfiguration<AssignmentRecipient>
{
    public void Configure(EntityTypeBuilder<AssignmentRecipient> builder)
    {
        builder.ToTable("AssignmentRecipients");
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.TenantId });
        builder.HasIndex(x => new { x.TenantId, x.AssignmentId, x.StudentId }).IsUnique();
        builder.HasIndex(x => new { x.TenantId, x.StudentId });
        builder.HasIndex(x => new { x.TenantId, x.SourceClassroomId });

        builder.HasOne(x => x.Assignment)
            .WithMany(x => x.Recipients)
            .HasForeignKey(x => new { x.AssignmentId, x.TenantId })
            .HasPrincipalKey(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.Student)
            .WithMany()
            .HasForeignKey(x => new { x.StudentId, x.TenantId })
            .HasPrincipalKey<Student>(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.SourceClassroom)
            .WithMany()
            .HasForeignKey(x => new { x.SourceClassroomId, x.TenantId })
            .HasPrincipalKey<Classroom>(x => new { x.Id, x.TenantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}
