using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Infrastructure.Persistence;

/// <summary>
/// حارس الكتابة لمستأجر. يُنفّذ مركزيًا على كل عمليات الحفظ:
/// - رفض حفظ كيان مملوك لمستأجر بدون سياق مستأجر محلول.
/// - تعيين TenantId من السياق فقط، ورفض client-supplied TenantId.
/// - منع تغيير TenantId بعد إنشاء السجل.
/// - رفض تعديل/حذف كيان يخص مستأجرًا آخر.
/// - تعيين CreatedAt/UpdatedAt للكيانات الشائعة.
/// Singleton؛ يحلّ ITenantContext من ChangeTracker.Context.CurrentTenantId وقت التنفيذ.
/// </summary>
public sealed class TenantSaveGuardInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        Enforce(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Enforce(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void Enforce(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var tenantEntityEntries = context.ChangeTracker.Entries()
            .Where(e => e.Entity is ITenantEntity && e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        // عدم وجود أي مساس بكيانات مستأجر = لا حاجة لسياق
        if (tenantEntityEntries.Count == 0)
        {
            return;
        }

        // أي مساس بكيان مستأجر بدون سياق ممنوع
        if (context is not AppDbContext appContext
            || appContext.CurrentTenantId is null
            || appContext.CurrentTenantId == TenantContext.UnresolvedTenantId)
        {
            throw new TenantWriteWithoutContextException();
        }

        var currentTenantId = appContext.CurrentTenantId.Value;
        var now = DateTime.UtcNow;

        foreach (var entry in tenantEntityEntries)
        {
            var entity = (ITenantEntity)entry.Entity;

            if (entry.State == EntityState.Added)
            {
                // رفض TenantId قادم من العميل/الكود — يجب أن يأتي من السياق فقط
                if (entity.TenantId != Guid.Empty && entity.TenantId != currentTenantId)
                {
                    throw new CrossTenantWriteRejectedException("Client-supplied TenantId is not allowed on insert.");
                }

                entity.TenantId = currentTenantId;
                SetStamp(entry, stamp: now, setCreated: true);
            }
            else
            {
                var originalTenantId = entry.Property(nameof(ITenantEntity.TenantId)).OriginalValue is Guid otid ? otid : Guid.Empty;
                if (originalTenantId != currentTenantId || entity.TenantId != currentTenantId)
                {
                    throw new CrossTenantWriteRejectedException("Mutation of an entity that belongs to a different tenant is rejected.");
                }

                var tenantIdProperty = entry.Property(nameof(ITenantEntity.TenantId));
                if (tenantIdProperty.IsModified)
                {
                    throw new CrossTenantWriteRejectedException("Changing TenantId after creation is not allowed.");
                }

                if (entry.State == EntityState.Modified)
                {
                    SetStamp(entry, stamp: now, setCreated: false);
                }
            }
        }
    }

    private static void SetStamp(
        Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry,
        DateTime stamp,
        bool setCreated)
    {
        if (setCreated)
        {
            var createdProperty = entry.Entity.GetType().GetProperty("CreatedAt");
            if (createdProperty is not null && createdProperty.CanWrite)
            {
                var current = createdProperty.GetValue(entry.Entity);
                if (current is DateTime dt && dt == default)
                {
                    createdProperty.SetValue(entry.Entity, stamp);
                }
            }
        }

        var updatedProperty = entry.Entity.GetType().GetProperty("UpdatedAt");
        if (updatedProperty is not null && updatedProperty.CanWrite)
        {
            updatedProperty.SetValue(entry.Entity, stamp);
        }
    }
}

/// <summary>محاولة كتابة على كيان مستأجر بدون سياق — فشل أمني، يعامل كـ500.</summary>
public sealed class TenantWriteWithoutContextException : InvalidOperationException
{
    public TenantWriteWithoutContextException()
        : base("Tenant-owned entity persistence requires a resolved tenant context.")
    {
    }
}

/// <summary>محاولة تجاوز عزل المستأجر — تُحوّل إلى 403 في الـAPI.</summary>
public sealed class CrossTenantWriteRejectedException : InvalidOperationException
{
    public CrossTenantWriteRejectedException(string message)
        : base(message)
    {
    }
}

