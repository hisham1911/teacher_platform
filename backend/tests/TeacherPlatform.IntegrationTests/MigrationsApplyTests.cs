using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Infrastructure.Persistence;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// Integration tests that require a real PostgreSQL instance.
/// Connection string is provided via INTEGRATION_TEST_DB environment variable.
/// Tests will fail explicitly if no PostgreSQL is available — no silent skipping.
///
/// يُجري اختبار تطبيق الـMigrations على قاعدة فارغة مؤقتة لكل Run (ساعة فريدة)،
/// ثم يحذف القاعدة — حتى لا يتعارض مع قاعدة الاختبار المشتركة التي تستعملها
/// TestWebApplicationFactory للاختبارات الوظيفية.
/// </summary>
[Trait("Category", "Integration")]
public class MigrationsApplyTests
{
    private static string GetRequiredBaseConnectionString()
    {
        var cs = Environment.GetEnvironmentVariable("INTEGRATION_TEST_DB");
        if (string.IsNullOrEmpty(cs))
        {
            throw new InvalidOperationException(
                "INTEGRATION_TEST_DB environment variable is required for integration tests. " +
                "Provide a valid PostgreSQL connection string.");
        }
        return cs;
    }

    /// <summary>يبني Connection String لقاعدة مؤقتة مشتقة من قاعدة الاختبار.</summary>
    private static (string FreshConnectionString, string DatabaseName, string AdminConnectionString) BuildFreshDatabase()
    {
        var baseCs = GetRequiredBaseConnectionString();
        var builder = new NpgsqlConnectionStringBuilder(baseCs);

        var database = $"tpi_migration_run_{Guid.NewGuid():N}";

        // Admin connection نحو postgres الافتراضية حتى نستطيع DROP/CREATE
        var adminBuilder = new NpgsqlConnectionStringBuilder(baseCs)
        {
            Database = "postgres"
        };

        builder.Database = database;
        return (builder.ConnectionString, database, adminBuilder.ConnectionString);
    }

    private static async Task CreateDroppedDatabaseAsync(
        string adminCs, string database, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(adminCs);
        await connection.OpenAsync(cancellationToken);

        // quoted identifier آمنة؛ الاسم GUID-only أحرف وأرقام
        var quoted = $"\"{Regex.Replace(database, "[^a-zA-Z0-9_]", string.Empty)}\"";
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE {quoted}";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task DropDatabaseIfExistsAsync(string adminCs, string database)
    {
        await using var connection = new NpgsqlConnection(adminCs);
        await connection.OpenAsync();

        var quoted = $"\"{Regex.Replace(database, "[^a-zA-Z0-9_]", string.Empty)}\"";

        await using (var terminate = connection.CreateCommand())
        {
            terminate.CommandText =
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = @db AND pid <> pg_backend_pid()
                """;
            terminate.Parameters.AddWithValue("db", database);
            await terminate.ExecuteNonQueryAsync();
        }

        await using var drop = connection.CreateCommand();
        drop.CommandText = $"DROP DATABASE IF EXISTS {quoted}";
        await drop.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task ApplyMigrations_CreatesExpectedTables_OnEmptyDatabase()
    {
        var (freshCs, database, adminCs) = BuildFreshDatabase();

        await CreateDroppedDatabaseAsync(adminCs, database, CancellationToken.None);
        try
        {
            await using var db = new AppDbContext(
                new DbContextOptionsBuilder<AppDbContext>()
                    .UseNpgsql(freshCs, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
                    .Options,
                new TenantContext());

            await db.Database.MigrateAsync();

            var systemMessages = await db.Database.SqlQuery<int>(
                $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name = 'SystemMessages'"
            ).ToListAsync();
            Assert.True(systemMessages[0] == 1, "SystemMessages table should exist after migrations");

            var identityTables = await db.Database.SqlQuery<int>(
                $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'AspNet%'"
            ).ToListAsync();
            Assert.True(identityTables[0] >= 7, "ASP.NET Identity tables should be present after migrations");

            var tenancyTables = await db.Database.SqlQuery<int>(
                $"""SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Tenants', 'TenantMemberships', 'TenantSettings')"""
            ).ToListAsync();
            Assert.True(tenancyTables[0] == 3, "Tenancy tables should be present after migrations");
        }
        finally
        {
            await DropDatabaseIfExistsAsync(adminCs, database);
        }
    }

    [Fact]
    public async Task HealthCheck_DatabaseConnection_IsHealthy()
    {
        var cs = GetRequiredBaseConnectionString();

        // إنشاء/تأكيد وجود قاعدة الاختبار الأساسية حتى يكون HealthCheck صحيحًا — دون تنظيف بيانات الاختبار المشتركة.
        var builder = new NpgsqlConnectionStringBuilder(cs);
        var adminCs = new NpgsqlConnectionStringBuilder(cs) { Database = "postgres" }.ConnectionString;
        var quoted = $"\"{Regex.Replace(builder.Database ?? "teacher_platform_test", "[^a-zA-Z0-9_]", string.Empty)}\"";

        await using (var admin = new NpgsqlConnection(adminCs))
        {
            await admin.OpenAsync();
            await using var checkDb = admin.CreateCommand();
            checkDb.CommandText = "SELECT 1 FROM pg_database WHERE datname = @db";
            checkDb.Parameters.AddWithValue("db", builder.Database ?? "teacher_platform_test");
            var exists = await checkDb.ExecuteScalarAsync();
            if (exists is null)
            {
                await using var create = admin.CreateCommand();
                create.CommandText = $"CREATE DATABASE {quoted}";
                await create.ExecuteNonQueryAsync();
            }
        }

        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(cs)
                .Options,
            new TenantContext());

        var canConnect = await db.Database.CanConnectAsync();
        Assert.True(canConnect, "Database should be connectable for health checks");
    }
}
