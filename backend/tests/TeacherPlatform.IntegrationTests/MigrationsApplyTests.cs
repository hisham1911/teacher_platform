using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Infrastructure.Persistence;
using Xunit;

namespace TeacherPlatform.IntegrationTests;

[Trait("Category", "Integration")]
public class MigrationsApplyTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task ApplyMigrations_CreatesExpectedTables()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        var hasSystemMessages = await db.Database.SqlQuery<int>(
            $"SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'SystemMessages'").ToListAsync();
        Assert.True(hasSystemMessages[0] > 0, "SystemMessages table should exist after migrations");
    }
}
