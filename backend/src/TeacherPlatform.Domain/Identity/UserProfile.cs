namespace TeacherPlatform.Domain.Identity;

/// <summary>
/// الملف الشخصي التعريفي للمستخدم. علاقة واحد لواحد مع ApplicationUser.
/// </summary>
public sealed class UserProfile
{
    public Guid UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>مفتاح الكائن في التخزين (لا يخزن URL).</summary>
    public string? AvatarObjectKey { get; set; }

    public string Locale { get; set; } = "ar";

    public UserProfileStatus Status { get; set; } = UserProfileStatus.Active;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ApplicationUser? User { get; set; }
}

public enum UserProfileStatus
{
    Active = 1,
    Suspended = 2
}
