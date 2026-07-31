using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Infrastructure.Persistence;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

/// <summary>
/// Integration tests that require a real PostgreSQL instance.
/// Connection string is provided via INTEGRATION_TEST_DB environment variable.
/// Tests will fail explicitly if no PostgreSQL is available — no silent skipping.
/// </summary>
[Trait("Category", "Integration")]
public class MigrationsApplyTests
{
    private static string GetRequiredConnectionString()
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

    [Fact]
    public async Task ApplyMigrations_CreatesExpectedTables()
    {
        var cs = GetRequiredConnectionString();

        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(cs, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
                .Options);

        await db.Database.MigrateAsync();

        var tables = await db.Database.SqlQuery<int>(
            $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'SystemMessages'"
        ).ToListAsync();

        Assert.True(tables[0] > 0, "SystemMessages table should exist after migrations");
    }

    [Fact]
    public async Task HealthCheck_DatabaseConnection_IsHealthy()
    {
        var cs = GetRequiredConnectionString();

        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(cs)
                .Options);

        var canConnect = await db.Database.CanConnectAsync();
        Assert.True(canConnect, "Database should be connectable for health checks");
    }
}
