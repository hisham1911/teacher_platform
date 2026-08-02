namespace TeacherPlatform.Domain.Identity;

/// <summary>
/// أسباب إلغاء رموز التحديث — ثوابت تدقيق مقروءة.
/// </summary>
public static class RefreshTokenRevocationReasons
{
    public const string ReplacedByRotation = "ReplacedByRotation";
    public const string Logout = "Logout";
    public const string ReuseDetected = "ReuseDetected";
    public const string PasswordReset = "PasswordReset";
}
