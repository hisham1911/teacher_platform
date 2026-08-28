using System.Security.Cryptography;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// يولّد رموز الطلاب من أبجدية خالية من الأحرف الملتبسة. الرمز ليس رقمًا متسلسلًا ولا يكشف أي معلومة عن الطالب.
/// </summary>
public static class StudentCodeGenerator
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    public const int DefaultLength = 8;

    public static string Generate(int length = DefaultLength)
    {
        if (length is < 6 or > 12)
        {
            throw new ArgumentOutOfRangeException(nameof(length));
        }

        var chars = new char[length];
        for (var index = 0; index < chars.Length; index += 1)
        {
            chars[index] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(chars);
    }

    public static string Normalize(string value) =>
        new(value.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
}
