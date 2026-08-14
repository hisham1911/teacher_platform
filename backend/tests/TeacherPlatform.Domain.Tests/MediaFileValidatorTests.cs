using System.IO;
using System.Text;
using TeacherPlatform.Application.Media;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Media;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

/// <summary>اختبارات فحص الوسائط: Magic bytes والحجم والنوع.</summary>
public class MediaFileValidatorTests
{
    private static StorageOptions Default => new();

    private static Stream Header(byte[] bytes) => new MemoryStream(bytes);

    [Fact]
    public void EmptyFile_Rejected()
    {
        var ok = MediaFileValidator.TryValidate(
            0, "image/png", "a.png", () => Header([0x89, 0x50, 0x4E, 0x47]),
            Default, out var result);

        Assert.False(ok);
        Assert.Equal("EmptyFile", result.ErrorCode);
    }

    [Fact]
    public void TooLargeImage_Rejected()
    {
        var opts = new StorageOptions { ImageMaxBytes = 1000 };
        var ok = MediaFileValidator.TryValidate(
            1001, "image/png", "a.png",
            () => Header([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            opts, out var result);

        Assert.False(ok);
        Assert.Equal("FileTooLarge", result.ErrorCode);
    }

    [Fact]
    public void TooLargeAudio_Rejected()
    {
        var opts = new StorageOptions { AudioMaxBytes = 1000 };
        var ok = MediaFileValidator.TryValidate(
            1001, "audio/mpeg", "a.mp3",
            () => Header([0x49, 0x44, 0x33]),
            opts, out var result);

        Assert.False(ok);
        Assert.Equal("FileTooLarge", result.ErrorCode);
    }

    [Fact]
    public void Png_WithValidMagicBytes_Passes()
    {
        var ok = MediaFileValidator.TryValidate(
            512,
            "image/png", "photo.png",
            () => Header([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]),
            Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Image, result.Outcome!.Kind);
        Assert.Equal(".png", result.Outcome.SafeExtension);
    }

    [Fact]
    public void Jpeg_WithValidMagicBytes_Passes()
    {
        var ok = MediaFileValidator.TryValidate(
            512,
            "image/jpeg", "photo.jpg",
            () => Header([0xFF, 0xD8, 0xFF, 0xE0, 0x00]),
            Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Image, result.Outcome!.Kind);
    }

    [Fact]
    public void Webp_WithRiffAndWebpContainer_Passes()
    {
        var ok = MediaFileValidator.TryValidate(
            512,
            "image/webp", "photo.webp",
            () => Header(Encoding.ASCII.GetBytes("RIFF\x10\x00\x00\x00WEBP")),
            Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Image, result.Outcome!.Kind);
    }

    [Fact]
    public void Webp_WithNonWebpRiffContainer_IsRejected()
    {
        var ok = MediaFileValidator.TryValidate(
            512,
            "image/webp", "photo.webp",
            () => Header(Encoding.ASCII.GetBytes("RIFF\x10\x00\x00\x00WAVE")),
            Default, out var result);

        Assert.False(ok);
        Assert.Equal("UnsupportedMediaType", result.ErrorCode);
    }

    [Fact]
    public void Svg_AlwaysRejected_EvenIfExtensionIsPng()
    {
        var svg = Encoding.ASCII.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'>");
        var ok = MediaFileValidator.TryValidate(
            svg.Length, "image/svg+xml", "icon.png",
            () => Header(svg), Default, out var result);

        Assert.False(ok);
        Assert.Equal("UnsupportedMediaType", result.ErrorCode);
    }

    [Fact]
    public void Mp3_WithId3Tag_Passes()
    {
        var ok = MediaFileValidator.TryValidate(
            4096,
            "audio/mpeg", "clip.mp3",
            () => Header(Encoding.ASCII.GetBytes("ID3\x04\x00\x00\x00\x00\x00\x21")),
            Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Audio, result.Outcome!.Kind);
        Assert.Equal(".mp3", result.Outcome.SafeExtension);
    }

    [Fact]
    public void Mp3_WithId3OnlyAtOffset4_IsRejected()
    {
        var fake = Encoding.ASCII.GetBytes("xxxxID3\x04\x00\x00");
        var ok = MediaFileValidator.TryValidate(
            fake.Length,
            "audio/mpeg", "clip.mp3",
            () => Header(fake), Default, out var result);

        Assert.False(ok);
        Assert.Equal("UnsupportedMediaType", result.ErrorCode);
    }

    [Fact]
    public void Wav_WithPcmFormat_Passes()
    {
        var wav = PcmWaveHeader(formatTag: 1);
        var ok = MediaFileValidator.TryValidate(
            4096,
            "audio/wav", "clip.wav",
            () => Header(wav),
            Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Audio, result.Outcome!.Kind);
    }

    [Fact]
    public void Wav_WithNonWaveRiffContainer_IsRejected()
    {
        var ok = MediaFileValidator.TryValidate(
            4096,
            "audio/wav", "clip.wav",
            () => Header(Encoding.ASCII.GetBytes("RIFF\x24\x08\x00\x00WEBP")),
            Default, out var result);

        Assert.False(ok);
        Assert.Equal("UnsupportedMediaType", result.ErrorCode);
    }

    [Fact]
    public void Wav_WithCompressedFormat_IsRejected()
    {
        var ok = MediaFileValidator.TryValidate(
            4096,
            "audio/wav", "clip.wav",
            () => Header(PcmWaveHeader(formatTag: 3)),
            Default, out var result);

        Assert.False(ok);
        Assert.Equal("UnsupportedMediaType", result.ErrorCode);
    }

    [Fact]
    public void M4a_WithFtypAtOffset4_Passes()
    {
        var m4a = new byte[12];
        Encoding.ASCII.GetBytes("ftyp").CopyTo(m4a, 4);
        m4a[8] = (byte)'M'; m4a[9] = (byte)'4'; m4a[10] = (byte)'A';

        var ok = MediaFileValidator.TryValidate(
            4096,
            "audio/mp4", "clip.m4a",
            () => Header(m4a), Default, out var result);

        Assert.True(ok);
        Assert.Equal(MediaKind.Audio, result.Outcome!.Kind);
        Assert.Equal(".m4a", result.Outcome.SafeExtension);
    }

    [Fact]
    public void FakeJpeg_WithHtmlContent_Rejected()
    {
        var fake = Encoding.ASCII.GetBytes("<html><body>not image</body></html>");
        var ok = MediaFileValidator.TryValidate(
            fake.Length, "image/jpeg", "fake.jpg",
            () => Header(fake), Default, out var result);

        Assert.False(ok);
    }

    [Fact]
    public void Executable_WithJpegExtension_Rejected()
    {
        var exe = new byte[12];
        exe[0] = 0x4D; exe[1] = 0x5A; // MZ
        var ok = MediaFileValidator.TryValidate(
            exe.Length, "image/jpeg", "virus.jpg",
            () => Header(exe), Default, out var result);

        Assert.False(ok);
    }

    private static byte[] PcmWaveHeader(ushort formatTag)
    {
        var header = new byte[44];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(header, 0);
        BitConverter.GetBytes(36).CopyTo(header, 4);
        Encoding.ASCII.GetBytes("WAVEfmt ").CopyTo(header, 8);
        BitConverter.GetBytes(16).CopyTo(header, 16);
        BitConverter.GetBytes(formatTag).CopyTo(header, 20);
        BitConverter.GetBytes((ushort)1).CopyTo(header, 22);
        BitConverter.GetBytes(44_100).CopyTo(header, 24);
        BitConverter.GetBytes(88_200).CopyTo(header, 28);
        BitConverter.GetBytes((ushort)2).CopyTo(header, 32);
        BitConverter.GetBytes((ushort)16).CopyTo(header, 34);
        Encoding.ASCII.GetBytes("data").CopyTo(header, 36);
        return header;
    }
}
