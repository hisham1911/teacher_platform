namespace TeacherPlatform.Application.Tenancy;

/// <summary>
/// سياق المستأجر الحالي للطلب. Scoped لكل طلب — ممنوع Static أو Singleton.
/// </summary>
public interface ITenantContext
{
    bool IsResolved { get; }

    Guid? TenantId { get; }
}
