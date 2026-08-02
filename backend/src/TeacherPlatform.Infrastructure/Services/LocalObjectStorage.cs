using TeacherPlatform.Application.Abstractions;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// تخزين كائنات محلي للتطوير والاختبارات. الجذر يُحل نسبيًا إلى ContentRootPath.
/// يمنع أي ObjectKey يحتوي .. أو يخرج عن الجذر — مفاتيح GUID آمنة فقط من الخدمة.
/// </summary>
public sealed class LocalObjectStorage : IObjectStorage
{
    private readonly string _rootPath;

    public LocalObjectStorage(Microsoft.AspNetCore.Hosting.IWebHostEnvironment environment, string rootPath)
    {
        var resolved = Path.IsPathRooted(rootPath)
            ? rootPath
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, rootPath));
        _rootPath = resolved;
        Directory.CreateDirectory(_rootPath);
    }

    private string ResolveSafePath(string objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey)
            || objectKey.Contains("..", StringComparison.Ordinal)
            || objectKey.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
        {
            throw new InvalidOperationException("Invalid object key.");
        }

        var fullPath = Path.GetFullPath(Path.Combine(_rootPath, objectKey.Replace('/', Path.DirectorySeparatorChar)));
        if (!fullPath.StartsWith(_rootPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Object key escapes the storage root.");
        }

        return fullPath;
    }

    public async Task UploadAsync(string objectKey, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSafePath(objectKey);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(target, cancellationToken);
    }

    public Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSafePath(objectKey);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("Object not found.", objectKey);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSafePath(objectKey);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSafePath(objectKey);
        return Task.FromResult(File.Exists(fullPath));
    }
}
