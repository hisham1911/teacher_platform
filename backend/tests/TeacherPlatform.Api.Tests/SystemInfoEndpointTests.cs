using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
using Xunit;

namespace TeacherPlatform.Api.Tests;

/// <summary>
/// اختبار سلامة أساسي يستخدم رمز المصنع WebApplicationFactory.
/// لا يتطلب قاعدة بيانات فعلية؛ الـ endpoint خارج النظام ومفصول عن DbContext.
/// </summary>
public class SystemInfoEndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task GetSystemInfo_ReturnsExpected()
    {
        // Arrange
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/system/info");
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<SystemInfoDto>();

        // Assert
        Assert.Equal("teacher-platform-api", payload?.Service);
        Assert.Equal("ok", payload?.Status);
        Assert.Equal("v1", payload?.ApiVersion);
    }

    private record SystemInfoDto(string Service, string Status, string ApiVersion, DateTime ServerTimeUtc);
}
