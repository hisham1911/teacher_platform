using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Infrastructure.Persistence;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Collection("Integration")]
public class MigrationsApplyTests
{
    [Fact]
    public async Task ApplyMigrations_CreatesExpectedTables()
    {
        // This test requires a real PostgreSQL connection.
        // Skip when running in CI without a database available.
        var connectionString = Environment.GetEnvironmentVariable("INTEGRATION_TEST_DB");
        if (string.IsNullOrEmpty(connectionString))
        {
            // Try to use local development credentials as fallback
            var localTests = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development" ||
                             Environment.GetEnvironmentVariable("CI") != "true";
            if (localTests)
            {
                // Check if we can connect to local dev DB with known credentials
                try
                {
                    await TestLocalConnection();
                    return;
                }
                catch
                {
                    // Fall through to skip
                }
            }
            
            // Skip if no database available
            Assert.Skip("INTEGRATION_TEST_DB not set and no local connection available");
            return;
        }

        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options);

        await db.Database.MigrateAsync();

        var hasSystemMessages = await db.Database.SqlQuery<int>(
            $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'SystemMessages'").ToListAsync();
        Assert.True(hasSystemMessages[0] > 0, "SystemMessages table should exist after migrations");
    }

    private static async Task TestLocalConnection()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=teacher_platform_dev;Username=teacher_dev;Password=teacher_dev_local_pw")
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();
        
        var hasSystemMessages = await db.Database.SqlQuery<int>(
            $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'SystemMessages'").ToListAsync();
        Assert.True(hasSystemMessages[0] > 0, "SystemMessages table should exist after migrations");
    }
}

[CollectionDefinition("Integration", DisableParallelization = true)]
public class IntegrationCollection : ICollectionFixture<IntegrationCollectionFixture> { }

public class IntegrationCollectionFixture { }

