using System.Security.Cryptography;
using System.Text;

namespace TeacherPlatform.Infrastructure.Services;

public static class StudentPortalTokenService
{
    public static string GenerateRawToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string ComputeHash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }

    public static bool Verify(string rawToken, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || string.IsNullOrWhiteSpace(storedHash)) return false;
        var candidate = Encoding.ASCII.GetBytes(ComputeHash(rawToken));
        var stored = Encoding.ASCII.GetBytes(storedHash);
        return candidate.Length == stored.Length && CryptographicOperations.FixedTimeEquals(candidate, stored);
    }

    public static string ResolveCookieName(string configuredName, bool useSecureCookie)
    {
        var baseName = string.IsNullOrWhiteSpace(configuredName) ? "tp-student" : configuredName.Trim();
        return useSecureCookie ? $"__Host-{baseName.TrimStart('_').Replace("Host-", string.Empty, StringComparison.OrdinalIgnoreCase)}" : baseName;
    }
}
