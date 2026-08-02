using System.Linq.Expressions;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// يبني تعبير Query Filter لكل كيان ITenantEntity بالشكل:
///   e => e.TenantId == dbContext.CurrentTenantId
/// يتم بناء الوصول إلى CurrentTenantId كَـ Member Access على نسخة AppDbContext نفسها
/// حتى يعيد EF Core ربط الفلتر بسياق التنفيذ الحالي في زمن الاستعلام (ولا يلتقط قيمة ثابتة
/// من سياق بناء النموذج).
/// </summary>
public static class TenantQueryFilterConvention
{
    public static LambdaExpression BuildTenantFilter(Type entityType, AppDbContext context)
    {
        var parameter = Expression.Parameter(entityType, "e");
        var tenantIdProperty = Expression.Property(parameter, nameof(ITenantEntity.TenantId));

        // Constant(AppDbContext) -> EF يستبدله بسياق الاستعلام الفعلي عند التشغيل
        var contextConstant = Expression.Constant(context, typeof(AppDbContext));
        var currentTenantId = Expression.Property(contextConstant, nameof(AppDbContext.CurrentTenantId));

        var leftAsNullable = Expression.Convert(tenantIdProperty, typeof(Guid?));
        var comparison = Expression.Equal(leftAsNullable, currentTenantId);

        return Expression.Lambda(comparison, parameter);
    }
}
