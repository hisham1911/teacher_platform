namespace TeacherPlatform.Application.Abstractions;

/// <summary>
/// ساعة النظام المحققة لتسهيل الاختبار مكان DateTime.UtcNow المباشر.
/// </summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
