using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// مصنع يستخدمه dotnet-ef لتوليد Migrations دون تشغيل التطبيق الكامل.
/// يقرأ Connection String من `ConnectionStrings__DefaultConnection` إن وُجد،
/// وإلا يفترض قيمة تطوير محلية غير سرية مناسبة فقط لأدوات Design-Time.
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

        // سياق مستأجر غير محلول في زمن التصميم — الفلاتر تُقيّم وقت التنفيذ وليس بناء النموذج.
        return new AppDbContext(builder.Options, new TenantContext());
    }
}
