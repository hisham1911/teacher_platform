using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// مرسل بريد Development: يكتب الرسائل إلى مجلد محلي مستبعد من Git (Foundation فقط).
/// لا يرسل عبر SMTP — ربط مزود الإنتاج يحتاج SMTP حقيقي لاحقًا.
/// </summary>
public sealed class FileEmailSender : IEmailSender
{
    private readonly string _dropDirectory;
    private readonly IHostEnvironment _env;
    private readonly ILogger<FileEmailSender> _logger;

    public FileEmailSender(
        IOptions<MailOptions> options,
        IHostEnvironment env,
        ILogger<FileEmailSender> logger)
    {
        _env = env;
        _logger = logger;

        var configured = options.Value.DevDropDirectory;
        _dropDirectory = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(env.ContentRootPath, configured);

        if (!_env.IsDevelopment())
        {
            throw new InvalidOperationException(
                "FileEmailSender is a development-only email sink. Configure a real SMTP provider outside Development.");
        }
    }

    public async Task SendAsync(string to, EmailKind kind, string actionUrl, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_dropDirectory);

        var payload = new { To = to, Kind = kind.ToString(), ActionUrl = actionUrl, AtUtc = DateTime.UtcNow };
        var file = Path.Combine(_dropDirectory, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(payload), cancellationToken);

        _logger.LogInformation("Dev email captured Kind={Kind} To={To} (file sink)", kind, to);
    }
}
