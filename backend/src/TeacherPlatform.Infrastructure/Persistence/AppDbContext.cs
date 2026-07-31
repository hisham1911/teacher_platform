using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Domain.Metadata;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// Phase 0 يفرض حد أدنى من الجداول لإثبات اتصال EF Core + PostgreSQL.
/// Phase 1 ستضيف جداول Identity ووتعدد العملاء.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<SystemMessage> SystemMessages => Set<SystemMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
