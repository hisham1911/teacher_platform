using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.IntegrationTests.Infrastructure;

/// <summary>
/// Factory لاختبارات تكامل حقيقية ضد PostgreSQL.
/// يلقّن Test Host ببيئة Testing حصرًا، ويحمّل appsettings.Testing.json من output
/// الخاص بالـAPI (CopyToOutputDirectory=PreserveNewest). لا تُحقن أي overrides إضافية
/// هنا بخلاف Connection Strings وData Protection المسار المؤقت المعزول لهذا الـfactory.
/// </summary>
public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _keysDirectory;
    public CaptureEmailSender EmailSender { get; } = new();

    public TestWebApplicationFactory()
    {
        // Testcontainers/CI run in Linux container; use temp أن يكون خارج مجلد الإصدار
        _keysDirectory = Path.Combine(Path.GetTempPath(), $"tp-keys-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_keysDirectory);
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting(WebHostDefaults.EnvironmentKey, "Testing");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            // Configuration واحد فقط:
            //  - appsettings.Testing.json (حقن كل JWT/Auth/Cors/RateLimit/Mail/IdentityLockout)
            //  - Overridesحدفق صغيرة: ConnectionStrings + DataProtection المسار المؤقت.
            var overrides = new Dictionary<string, string?>
            {
                ["DataProtection:KeysDirectory"] = _keysDirectory,
                ["ConnectionStrings:DefaultConnection"] =
                    Environment.GetEnvironmentVariable("INTEGRATION_TEST_DB")
                    ?? throw new InvalidOperationException("INTEGRATION_TEST_DB is required for integration tests.")
            };
            config.AddInMemoryCollection(overrides);
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton(EmailSender);
            services.AddSingleton<IEmailSender>(EmailSender);
        });
    }

    /// <summary>
    /// التأكد من أن قاعدة الاختبار مهيأة (Database exists + Migrations applied).
    /// يُستدعى بشكل كسول عند أول طلب HTTP من الاختبارات.
    /// قفل ثابت عبر كل نسخ الـFactory حتى لا تتصارع Migrations عند توازي xUnit Collections.
    /// </summary>
    private static readonly SemaphoreSlim MigrationLock = new(1, 1);
    private static volatile bool _migrated;

    public async Task EnsureDatabaseCreatedAsync(CancellationToken cancellationToken = default)
    {
        if (_migrated)
        {
            return;
        }

        await MigrationLock.WaitAsync(cancellationToken);
        try
        {
            if (_migrated)
            {
                return;
            }

            await using var scope = Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync(cancellationToken);
            _migrated = true;
        }
        finally
        {
            MigrationLock.Release();
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            try
            {
                if (Directory.Exists(_keysDirectory))
                {
                    Directory.Delete(_keysDirectory, recursive: true);
                }
            }
            catch { /* best effort */ }
        }
        base.Dispose(disposing);
    }
}

/// <summary>مرسل بريد Capture يسمح للاختبارات بقراءة روابط التفعيل/إعادة التعيين دون كشفها للمستخدم.</summary>
public sealed class CaptureEmailSender : IEmailSender
{
    private readonly List<(string To, EmailKind Kind, string ActionUrl)> _messages = new();
    private readonly object _lock = new();

    public Task SendAsync(string to, EmailKind kind, string actionUrl, CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            _messages.Add((to, kind, actionUrl));
        }
        return Task.CompletedTask;
    }

    public IReadOnlyList<(string To, EmailKind Kind, string ActionUrl)> Messages
    {
        get { lock (_lock) { return _messages.ToList(); } }
    }

    public string? LastActionUrlFor(string to, EmailKind kind)
    {
        lock (_lock)
        {
            return _messages.LastOrDefault(m => m.To == to && m.Kind == kind).ActionUrl;
        }
    }

    public void Clear()
    {
        lock (_lock) { _messages.Clear(); }
    }
}

public static class TestDataBuilder
{
    public static System.Text.Json.JsonSerializerOptions JsonOptions { get; } = new()
    {
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
    };

    public static StringContent Json(object payload) =>
        new(System.Text.Json.JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
}
