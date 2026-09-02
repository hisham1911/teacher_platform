using TeacherPlatform.Domain.Assignments;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

public sealed class AssignmentScheduleRulesTests
{
    private static readonly DateTime CreatedAt = new(2026, 9, 2, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void NoDueDate_IsValid()
    {
        Assert.True(AssignmentScheduleRules.IsValid(null, null, CreatedAt));
    }

    [Fact]
    public void DueDateAfterCreation_IsValid_WhenAvailabilityIsNotSpecified()
    {
        Assert.True(AssignmentScheduleRules.IsValid(null, CreatedAt.AddMinutes(1), CreatedAt));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void DueDateMustBeStrictlyAfterCreation_WhenAvailabilityIsNotSpecified(int minuteOffset)
    {
        Assert.False(AssignmentScheduleRules.IsValid(null, CreatedAt.AddMinutes(minuteOffset), CreatedAt));
    }

    [Fact]
    public void DueDateAfterAvailability_IsValid()
    {
        var availableAt = CreatedAt.AddHours(1);
        Assert.True(AssignmentScheduleRules.IsValid(availableAt, availableAt.AddMinutes(1), CreatedAt));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void DueDateMustBeStrictlyAfterAvailability(int minuteOffset)
    {
        var availableAt = CreatedAt.AddHours(1);
        Assert.False(AssignmentScheduleRules.IsValid(availableAt, availableAt.AddMinutes(minuteOffset), CreatedAt));
    }
}
