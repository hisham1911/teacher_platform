using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly MailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<MailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(
        string to,
        EmailKind kind,
        string actionUrl,
        CancellationToken cancellationToken = default)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(_options.FromAddress!, _options.FromName),
            Subject = kind == EmailKind.Confirmation
                ? "تأكيد بريدك في منصة المعلم"
                : "إعادة تعيين كلمة المرور في منصة المعلم",
            Body = kind == EmailKind.Confirmation
                ? $"لتأكيد بريدك افتح الرابط التالي:\n{actionUrl}"
                : $"لإعادة تعيين كلمة المرور افتح الرابط التالي:\n{actionUrl}"
        };
        message.To.Add(new MailAddress(to));

        using var client = new SmtpClient(_options.Host!, _options.Port)
        {
            EnableSsl = _options.Security == "StartTls",
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };
        if (!string.IsNullOrWhiteSpace(_options.Username))
        {
            client.Credentials = new System.Net.NetworkCredential(_options.Username, _options.Password);
        }
        await client.SendMailAsync(message, cancellationToken);

        _logger.LogInformation("Email sent Kind={Kind} To={To} via SMTP.", kind, to);
    }
}
