using System.Buffers.Binary;
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
    public const int HeaderInspectionLimitBytes = 64 * 1024;

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

        var header = ReadHeader(stream);
        if (!MatchesSignature(header, ruleMatches.SelectMany(r => r.Signatures))
            || !MatchesContainer(ruleMatches[0].Extension, header))
        {
            result = (null, "UnsupportedMediaType");
            return false;
        }

        result = (new ValidationOutcome(kind, ruleMatches[0].Extension), null);
        return true;
    }

    /// <summary>
    /// يقارن الترويسة بالتوقيعات المعروفة.
    /// ftyp لـM4A يظهر عند البايت 4.
    /// </summary>
    private static bool MatchesSignature(ReadOnlySpan<byte> header, IEnumerable<byte[]> signatures)
    {
        foreach (var signature in signatures)
        {
            if (header.Length < signature.Length)
            {
                continue;
            }

            if (header.StartsWith(signature))
            {
                return true;
            }

            if (signature.AsSpan().SequenceEqual("ftyp"u8)
                && header.Length >= signature.Length + 4
                && header[4..].StartsWith(signature))
            {
                return true;
            }
        }

        return false;
    }

    private static byte[] ReadHeader(Stream stream)
    {
        using var buffer = new MemoryStream(HeaderInspectionLimitBytes);
        var chunk = new byte[4096];
        while (buffer.Length < HeaderInspectionLimitBytes)
        {
            var remaining = HeaderInspectionLimitBytes - (int)buffer.Length;
            var read = stream.Read(chunk, 0, Math.Min(chunk.Length, remaining));
            if (read == 0)
            {
                break;
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    private static bool MatchesContainer(string extension, ReadOnlySpan<byte> header) => extension switch
    {
        ".webp" => header.Length >= 12 && header[8..12].SequenceEqual("WEBP"u8),
        ".wav" => IsPcmWave(header),
        _ => true
    };

    private static bool IsPcmWave(ReadOnlySpan<byte> header)
    {
        if (header.Length < 20
            || !header[..4].SequenceEqual("RIFF"u8)
            || !header[8..12].SequenceEqual("WAVE"u8))
        {
            return false;
        }

        var offset = 12;
        while (offset <= header.Length - 8)
        {
            var chunkId = header.Slice(offset, 4);
            var chunkSize = BinaryPrimitives.ReadUInt32LittleEndian(header.Slice(offset + 4, 4));
            var dataOffset = offset + 8;
            if (chunkId.SequenceEqual("fmt "u8))
            {
                return chunkSize >= 2
                    && dataOffset <= header.Length - 2
                    && BinaryPrimitives.ReadUInt16LittleEndian(header.Slice(dataOffset, 2)) == 1;
            }

            var paddedSize = (long)chunkSize + (chunkSize & 1);
            var nextOffset = dataOffset + paddedSize;
            if (nextOffset > header.Length || nextOffset > int.MaxValue)
            {
                return false;
            }

            offset = (int)nextOffset;
        }

        return false;
    }

    private static class MediaFileValidatorRules
    {
        public static bool IsAudioExtension(string ext) => ext is ".mp3" or ".wav" or ".m4a";
    }
}
