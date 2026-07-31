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
            ?? "Host=localhost;Port=5432;Database=teacher_platform_dev;Username=teacher_dev;Password=teacher_dev_local_pw";

        builder.UseNpgsql(connectionString, options =>
        {
            options.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
        });

        return new AppDbContext(builder.Options);
    }
}
