using Microsoft.AspNetCore.Identity;

namespace TeacherPlatform.Domain.Identity;

/// <summary>
/// مستخدم الهوية. البيانات التعريفية القابلة للتوسع تعيش في UserProfile وليس هنا.
/// </summary>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>مرجع تنقلي للملف الشخصي (واحد لواحد).</summary>
    public UserProfile? Profile { get; set; }
}
