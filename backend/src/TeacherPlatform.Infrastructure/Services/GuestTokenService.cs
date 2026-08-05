using System.Security.Cryptography;
using System.Text;
using TeacherPlatform.Application.Abstractions;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// خدمة رموز الضيوف للاعبين — 256-bit عشوائي تشفيري، تخزين التجزئة فقط (SHA-256 hex)،
/// ومقارنة Constant-time لمنع Timing attacks. لا يُخزَّن الرمز الخام أبدًا ولا يُسجَّل.
///
/// الكوكي: HttpOnly + IsEssential + Path=/ + SameSite حسب الإعدادات.
/// في Production (Secure=true) يُستخدم الاسم الصارم __Host-tp-guest الذي يتطلب
/// Secure + Path=/ + بدون Domain؛ في Development (HTTP) يُستخدم tp-guest لأن
/// المتصفحات ترفض تخزين كوكي __Host- بدون Secure.
/// </summary>
public sealed class GuestTokenService
{
    public const string CookieNameSecure = "__Host-tp-guest";
    public const string CookieNameDev = "tp-guest";

    private readonly IClock _clock;

    public GuestTokenService(IClock clock)
    {
        _clock = clock;
    }

    /// <summary>يولّد رمز ضيف جديد: 256-bit عشوائي تشفيري بترميز Base64Url الآمن للروابط.</summary>
    public static string GenerateRawToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Base64UrlEncode(bytes);
    }

    /// <summary>يحسب تجزئة SHA-256 (hex كبير، 64 حرفًا) — القيمة الوحيدة التي تُخزَّن.</summary>
    public static string ComputeHash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }

    /// <summary>
    /// يتحقق من رمز خام مقابل التجزئة المخزنة بمقارنة Constant-time.
    /// </summary>
    public static bool Verify(string rawToken, string storedHash)
    {
        if (string.IsNullOrEmpty(rawToken) || string.IsNullOrEmpty(storedHash))
        {
            return false;
        }

        var candidateHash = ComputeHash(rawToken);
        var candidateBytes = Encoding.ASCII.GetBytes(candidateHash);
        var storedBytes = Encoding.ASCII.GetBytes(storedHash);
        if (candidateBytes.Length != storedBytes.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(candidateBytes, storedBytes);
    }

    /// <summary>وقت انتهاء صلاحية رمز جديد اعتبارًا من الآن.</summary>
    public DateTime ComputeExpiry(int guestTokenDays) => _clock.UtcNow.AddDays(guestTokenDays);

    /// <summary>
    /// يولّد رمز انضمام قصيرًا قابلًا للقراءة والكتابة يدويًا:
    /// أبجدية Base32 بدون الأحرف الملتبسة (I/L/O/0/1)، عشوائية تشفيرية.
    /// </summary>
    public static string GenerateJoinCode(int length)
    {
        const string alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        var bytes = RandomNumberGenerator.GetBytes(length);
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = alphabet[bytes[i] % alphabet.Length];
        }

        return new string(chars);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
