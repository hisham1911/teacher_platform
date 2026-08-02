using TeacherPlatform.Application.Tenancy;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// سياق مستأجر scoped لكل طلب HTTP.
/// لا يستخدم Static أو Singleton.
/// </summary>
public sealed class TenantContext : ITenantContext
{
    /// <summary>معرف لا يطابق أي سجل — يجعل Query Filter لا يعيد شيئًا عند غياب السياق.</summary>
    public static readonly Guid UnresolvedTenantId = Guid.Empty;

    /// <summary>جلسة bootstrap مؤقتة (لإنشاء Tenant الأول + العضوية + الإعدادات) — لا تفتح العزل للقراءات الخارجية.</summary>
    public sealed class BootstrapSession : IDisposable
    {
        public BootstrapSession(TenantContext context, Guid tenantId)
        {
            Context = context;
            context.SetResolved(tenantId);
        }

        public TenantContext Context { get; }

        public void Dispose() => Context.Clear();
    }

    public bool IsResolved { get; private set; }

    public Guid? TenantId { get; private set; }

    public void SetResolved(Guid tenantId)
    {
        IsResolved = true;
        TenantId = tenantId;
    }

    public void Clear()
    {
        IsResolved = false;
        TenantId = null;
    }

    public BootstrapSession BeginBootstrap(Guid tenantId) => new(this, tenantId);
}
