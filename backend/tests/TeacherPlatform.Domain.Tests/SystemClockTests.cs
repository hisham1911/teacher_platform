using TeacherPlatform.Application.Abstractions;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

// quick placeholder until Phase 1 adds real domain entities
public class SystemClockTests
{
    [Fact]
    public void SystemClock_ReturnsUtc()
    {
        IClock clock = new SystemClock();
        var now = clock.UtcNow;
        Assert.True(now.Kind == DateTimeKind.Utc);
    }
}
