namespace TeacherPlatform.Api.Authorization;

public static class AuthorizationPolicies
{
    public const string AuthenticatedUser = "AuthenticatedUser";
    public const string PlatformAdmin = "PlatformAdmin";
    public const string ActiveTenantMember = "ActiveTenantMember";
    public const string TenantOwner = "TenantOwner";
    public const string TenantMemberManagement = "TenantMemberManagement";
    public const string TenantSettingsManagement = "TenantSettingsManagement";
}

public static class RateLimitPolicies
{
    public const string AuthEndpoints = "auth-endpoints";
}
