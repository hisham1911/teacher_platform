using System.Security.Cryptography;
using System.Text;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// يولد Access Codes عالية العشوائية وقابلة للكتابة يدويًا.
/// LookupDigest فقط هو المستخدم في البحث؛ الكود الخام لا يُخزن.
/// </summary>
public static class StudentPortalCodeService
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static string Generate(int length)
    {
        if (length < 12 || length > 24)
        {
            throw new ArgumentOutOfRangeException(nameof(length));
        }

        var chars = new char[length];
        for (var i = 0; i < length; i += 1)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }
        return new string(chars);
    }

    public static string Normalize(string? value) => string.IsNullOrWhiteSpace(value)
        ? string.Empty
        : new string(value
            .ToUpperInvariant()
            .Where(char.IsLetterOrDigit)
            .ToArray());

    public static string ComputeLookupDigest(string normalizedCode)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedCode));
        return Convert.ToHexString(bytes);
    }

    public static string Format(string normalizedCode)
    {
        if (normalizedCode.Length <= 4) return normalizedCode;
        return string.Join('-', Enumerable.Range(0, (normalizedCode.Length + 3) / 4)
            .Select(index => normalizedCode.Substring(index * 4, Math.Min(4, normalizedCode.Length - index * 4))));
    }
}
