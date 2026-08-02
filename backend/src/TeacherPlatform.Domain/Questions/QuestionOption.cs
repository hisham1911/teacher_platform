using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Questions;

/// <summary>
/// اختيار ضمن نسخة سؤال. مرتبط بنسخة محددة لكنه Tenant-owned مباشرة
/// حتى يبقى Query Filter والحارس المركزي ساريين، ويبقى FK مركّب
/// (QuestionVersionId, TenantId) مانعًا لأي ربط Cross-tenant.
/// Options التابعة لنسخة تاريخية لا تتغير أبدًا.
/// </summary>
public sealed class QuestionOption : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid QuestionVersionId { get; set; }

    public int SortOrder { get; set; }

    public string OptionText { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public QuestionVersion? QuestionVersion { get; set; }
}
