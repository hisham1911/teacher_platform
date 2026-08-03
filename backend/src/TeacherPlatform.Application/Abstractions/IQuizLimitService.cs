namespace TeacherPlatform.Application.Abstractions;

/// <summary>
/// فحص حدود الاستخدام المؤقتة للاختبارات — عدّ حقيقي من قاعدة البيانات في السيرفر.
/// تُرجع ServiceResultException برمز "QuotaExceeded" عند تجاوز الحد، أو null عند السماح.
/// </summary>
public interface IQuizLimitService
{
    /// <summary>هل يمكن للمستأجر إنشاء اختبار جديد؟</summary>
    Task<ServiceResultException?> CheckCanCreateQuizAsync(Guid tenantId, CancellationToken ct);

    /// <summary>هل يمكن إضافة سؤال جديد إلى مسودة الاختبار؟</summary>
    Task<ServiceResultException?> CheckCanAddQuestionAsync(Guid tenantId, Guid quizVersionId, CancellationToken ct);

    /// <summary>هل يمكن نشر اختبار (حد الاختبارات المنشورة)؟ يُستثنى الاختبار نفسه إن كان منشورًا مسبقًا.</summary>
    Task<ServiceResultException?> CheckCanPublishAsync(Guid tenantId, Guid quizId, CancellationToken ct);
}
