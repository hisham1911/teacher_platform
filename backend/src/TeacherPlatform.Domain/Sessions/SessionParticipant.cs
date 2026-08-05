using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// مشارك في جلسة اختبار — طالب مجهول الهوية (Guest).
/// يُخزَّن GuestTokenHash فقط (SHA-256) — لا يُخزَّن الرمز الخام أبداً.
/// المقارنة تتم بـ Constant-time لمنع Timing attacks.
/// </summary>
public sealed class SessionParticipant : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid SessionId { get; set; }

    /// <summary>اسم العرض الذي أدخله الطالب (2–50 حرفاً).</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>SHA-256 hex (64 حرفاً) من رمز الضيف — لا يُخزَّن الرمز الخام.</summary>
    public string GuestTokenHash { get; set; } = string.Empty;

    /// <summary>انتهاء صلاحية رمز الضيف — بعدها يجب الانضمام مجدداً.</summary>
    public DateTime GuestTokenExpiresAt { get; set; }

    public DateTime JoinedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public QuizSession? Session { get; set; }

    public Attempt? Attempt { get; set; }
}
