namespace TeacherPlatform.Domain.Metadata;

/// <summary>
/// كيان تأسيسي بسيط لإثبات أن ORM وMigrations والاتصال بقاعدة البيانات يعمل.
/// لا يمثل ميزة تجارية في Phase 0.
/// </summary>
public sealed class SystemMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Code { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
