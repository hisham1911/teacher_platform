using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// مصنع يستخدمه dotnet-ef لتوليد Migrations دون تشغيل التطبيق الكامل.
/// يقرأ Connection String من متغيرات البيئة أو يستخدم قيمة تطوير افتراضية محلية.
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>();

        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings__DefaultConnection environment variable is required for design-time tools. " +
                "Set it to your local development database connection string.");

        builder.UseNpgsql(connectionString, options =>
        {
            options.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
        });

        return new AppDbContext(builder.Options);
    }
}
