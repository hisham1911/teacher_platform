namespace TeacherPlatform.Domain.Assignments;

/// <summary>
/// Business-time rules for a persistent assignment. DueAt is optional, but when present it must
/// be strictly later than the effective opening boundary: AvailableAt when supplied, otherwise
/// the assignment creation time.
/// </summary>
public static class AssignmentScheduleRules
{
    public static bool IsValid(DateTime? availableAt, DateTime? dueAt, DateTime creationTime)
    {
        if (dueAt is null)
        {
            return true;
        }

        return dueAt > (availableAt ?? creationTime);
    }
}
