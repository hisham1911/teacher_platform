namespace TeacherPlatform.Domain.Common;

/// <summary>
/// نواة أساسية لأحداث المجال عند الحاجة المستقبلية.
/// Phase 0 لا يحتاج تنفيذ منطق إضافي.
/// </summary>
public abstract record DomainEvent(Guid AggregateId, DateTime OccurredAtUtc);
