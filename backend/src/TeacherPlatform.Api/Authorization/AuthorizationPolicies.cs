namespace TeacherPlatform.Api.Authorization;

public static class AuthorizationPolicies
{
    public const string AuthenticatedUser = "AuthenticatedUser";
    public const string PlatformAdmin = "PlatformAdmin";
    public const string ActiveTenantMember = "ActiveTenantMember";
    public const string TenantOwner = "TenantOwner";
    public const string TenantMemberManagement = "TenantMemberManagement";
    public const string TenantSettingsManagement = "TenantSettingsManagement";

    /// <summary>كتابة المحتوى التعليمي (بنوك، أسئلة): Owner وTeacher فقط — Assistant/Viewer للقراءة.</summary>
    public const string TenantContentManagement = "TenantContentManagement";
}

public static class RateLimitPolicies
{
    public const string AuthEndpoints = "auth-endpoints";

    /// <summary>مسارات اللاعب المجهول — حد مستقل بنفس إعدادات النافذة.</summary>
    public const string PlayerEndpoints = "player-endpoints";
}
