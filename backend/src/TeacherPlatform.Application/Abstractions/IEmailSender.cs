namespace TeacherPlatform.Application.Abstractions;

public enum EmailKind
{
    Confirmation = 1,
    PasswordReset = 2
}

/// <summary>
/// تجريد إرسال البريد. المرحلة الحالية: Foundation فقط —
/// مرسل ملفات Development ومرسل التقاط للاختبارات. الربط بمزود SMTP حقيقي لاحقًا.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(string to, EmailKind kind, string actionUrl, CancellationToken cancellationToken = default);
}
