using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Media;

namespace TeacherPlatform.Application.Media;

/// <summary>
/// فحص ملف وسائط قبل الرفع: الحجم (قابل للإعداد) والامتداد وMIME وMagic bytes.
/// لا نثق باسم الملف ولا Content-Type المرسل من العميل — المحتوى هو الفيصل.
/// SVG مرفوض دائمًا (مخاطر script injection).
/// </summary>
public static class MediaFileValidator
{
    private static readonly (string Mime, string Extension, byte[][] Signatures)[] Rules =
    [
        ("image/jpeg", ".jpg", [new byte[] { 0xFF, 0xD8, 0xFF }]),
        ("image/jpeg", ".jpeg", [new byte[] { 0xFF, 0xD8, 0xFF }]),
        ("image/png", ".png", [new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }]),
        ("image/webp", ".webp", [System.Text.Encoding.ASCII.GetBytes("RIFF")]),
        ("audio/mpeg", ".mp3", [new byte[] { 0xFF, 0xFB }, new byte[] { 0xFF, 0xF3 }, new byte[] { 0xFF, 0xF2 }, System.Text.Encoding.ASCII.GetBytes("ID3")]),
        ("audio/wav", ".wav", [System.Text.Encoding.ASCII.GetBytes("RIFF")]),
        ("audio/x-wav", ".wav", [System.Text.Encoding.ASCII.GetBytes("RIFF")]),
        ("audio/mp4", ".m4a", [System.Text.Encoding.ASCII.GetBytes("ftyp")]), // يُبحث عنها عند offset 4
        ("audio/x-m4a", ".m4a", [System.Text.Encoding.ASCII.GetBytes("ftyp")])
    ];

    public sealed record ValidationOutcome(MediaKind Kind, string SafeExtension);

    /// <summary>
    /// يتحقق من الملف ويعيد نوعه وامتداده الآمن. errorCode من مجموعة:
    /// EmptyFile, FileTooLarge, UnsupportedMediaType.
    /// المُستدعي يترجمها إلى ProblemDetails عبر ServiceResultException.
    /// </summary>
    public static bool TryValidate(
        long sizeBytes,
        string? declaredMime,
        string? declaredFileName,
        Func<Stream?> readHeader,
        StorageOptions options,
        out (ValidationOutcome? Outcome, string? ErrorCode) result)
    {
        result = (null, null);

        if (sizeBytes <= 0)
        {
            result = (null, "EmptyFile");
            return false;
        }

        var declaredExt = Path.GetExtension(declaredFileName ?? string.Empty).ToLowerInvariant();
        var mime = (declaredMime ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();

        var ruleMatches = Rules.Where(r =>
            (mime.Length == 0 || r.Mime == mime) && (declaredExt.Length == 0 || r.Extension == declaredExt))
            .ToList();

        if (ruleMatches.Count == 0)
        {
            // حتى لو تعارض الاسم مع MIME، النتيجة واحدة: مرفوض — لا نكشف تفاصيل
            result = (null, "UnsupportedMediaType");
            return false;
        }

        var stream = readHeader();
        if (stream is null)
        {
            result = (null, "UnsupportedMediaType");
            return false;
        }

        var kind = mime.StartsWith("audio/", StringComparison.Ordinal)
            || MediaFileValidatorRules.IsAudioExtension(ruleMatches[0].Extension)
            ? MediaKind.Audio
            : MediaKind.Image;

        var maxBytes = kind == MediaKind.Image ? options.ImageMaxBytes : options.AudioMaxBytes;
        if (sizeBytes > maxBytes)
        {
            result = (null, "FileTooLarge");
            return false;
        }

        if (!MatchesSignature(stream, ruleMatches.SelectMany(r => r.Signatures)))
        {
            result = (null, "UnsupportedMediaType");
            return false;
        }

        result = (new ValidationOutcome(kind, ruleMatches[0].Extension), null);
        return true;
    }

    /// <summary>
    /// يقرأ أول 12 بايت ويقارنها بالتوقيعات المعروفة.
    /// ftyp لـM4A يظهر عند البايت 4؛ RIFF لـWEBP وWAV يتبعه تمييز إضافي.
    /// </summary>
    private static bool MatchesSignature(Stream stream, IEnumerable<byte[]> signatures)
    {
        Span<byte> header = stackalloc byte[12];
        var read = stream.Read(header);

        foreach (var signature in signatures)
        {
            if (read < signature.Length)
            {
                continue;
            }

            // فحص offset 0 أولاً
            var atStart = true;
            for (var i = 0; i < signature.Length; i++)
            {
                if (header[i] != signature[i])
                {
                    atStart = false;
                    break;
                }
            }

            if (atStart)
            {
                return true;
            }

            // فحص offset 4 (ftyp في ملفات M4A / MP4-like)
            if (read >= signature.Length + 4)
            {
                var at4 = true;
                for (var i = 0; i < signature.Length; i++)
                {
                    if (header[4 + i] != signature[i])
                    {
                        at4 = false;
                        break;
                    }
                }

                if (at4)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static class MediaFileValidatorRules
    {
        public static bool IsAudioExtension(string ext) => ext is ".mp3" or ".wav" or ".m4a";
    }
}
