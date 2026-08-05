using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

/// <summary>
/// إعدادات جلسات اللعب والمحاولات — تُفرض في السيرفر فقط ولا يمكن تجاوزها من العميل.
/// قابلة للإعداد بدون إعادة نشر.
/// </summary>
public sealed class SessionOptions
{
    public const string SectionName = "Session";

    /// <summary>
    /// نافذة السماح بالثواني بعد انتهاء المهلة — تُقبل الإجابات المتأخرة ضمنها
    /// ثم تُنهى المحاولة تلقائيًا عند أول طلب بعدها (Settle-on-request).
    /// </summary>
    [Range(0, 300)]
    public int GraceWindowSeconds { get; set; } = 10;

    /// <summary>مدة صلاحية رمز الضيف بالأيام — بعدها يجب الانضمام من جديد.</summary>
    [Range(1, 365)]
    public int GuestTokenDays { get; set; } = 30;

    /// <summary>طول رمز الانضمام للجلسة (JoinCode) — أبجدية Base32 آمنة للروابط.</summary>
    [Range(6, 32)]
    public int JoinCodeLength { get; set; } = 8;

    /// <summary>أقصى عدد مشاركين في جلسة واحدة — حد إساءة على مستوى السيرفر.</summary>
    [Range(1, 10000)]
    public int MaxParticipantsPerSession { get; set; } = 500;
}
