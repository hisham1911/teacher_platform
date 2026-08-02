using Microsoft.AspNetCore.Identity;

namespace TeacherPlatform.Domain.Identity;

/// <summary>
/// دور الهوية. الدور العالمي الوحيد المعرف حاليًا هو PlatformAdmin.
/// أدوار المستأجر (Owner/Teacher/...) لا تعيش هنا بل في TenantMembership.
/// </summary>
public sealed class ApplicationRole : IdentityRole<Guid>
{
}
