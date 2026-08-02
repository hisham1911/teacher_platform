using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Json;
using Xunit;

namespace TeacherPlatform.Api.Tests;

public sealed class SystemInfoWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        // بيئة Testing حتى تُحمَّل appsettings.Testing.json من مجلد الـAPI (تحتوي قيم Phase 1 الاختبارية).
        builder.UseSetting(Microsoft.AspNetCore.Hosting.WebHostDefaults.EnvironmentKey, "Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Overrides دنيا فقط: لا حاجة فعلية لقاعدة في اختبار smoke، لكن Health Check
            // لن يُستدعى هنا. الإعداد المتبقّي يأتي من appsettings.Testing.json.
            var overrides = new Dictionary<string, string?>
            {
                ["DataProtection:KeysDirectory"] =
                    Path.Combine(Path.GetTempPath(), $"tp-smoke-keys-{Guid.NewGuid():N}")
            };
            config.AddInMemoryCollection(overrides);
        });
    }
}

public class SystemInfoEndpointTests(SystemInfoWebApplicationFactory factory) : IClassFixture<SystemInfoWebApplicationFactory>
{
    [Fact]
    public async Task GetSystemInfo_ReturnsExpected()
    {
        var response = await factory.CreateClient().GetAsync("/api/v1/system/info");
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<SystemInfoDto>();
        Assert.Equal("teacher-platform-api", payload?.Service);
        Assert.Equal("ok", payload?.Status);
        Assert.Equal("v1", payload?.ApiVersion);
    }

    private record SystemInfoDto(string Service, string Status, string ApiVersion, DateTime ServerTimeUtc);
}
