namespace TeacherPlatform.Domain.Tenancy;

/// <summary>
/// واجهة كيان مملوك لمستأجر. كل كيان يطبقها يخضع لـ:
/// - EF Global Query Filter: لا قراءة خارج TenantId الحالي.
/// - SaveChanges Tenant Guard: لا كتابة بدون سياق، ولا تغيير TenantId، ولا تعديل كيان مستأجر آخر.
/// الوضع الآمن الافتراضي عند غياب السياق: لا تُعرض ولا تُكتب بيانات مستأجر.
/// </summary>
public interface ITenantEntity
{
    Guid TenantId { get; set; }
}
