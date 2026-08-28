using TeacherPlatform.Domain.Students;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// هوية اللاعب داخل جلسة واحدة. كل مشارك يحصل على Guest Token خاص بالجلسة لاستكمال الطلبات بأمان.
/// StudentId اختياري: إذا كان موجودًا فالطالب معروف من سجل المعلمة؛ وإذا كان null فالمشارك ضيف.
/// </summary>
public sealed class SessionParticipant : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid SessionId { get; set; }

    /// <summary>هوية الطالب الدائمة داخل مساحة العمل؛ null للمشاركة كضيف.</summary>
    public Guid? StudentId { get; set; }

    /// <summary>لقطة من اسم الطالب وقت الانضمام، أو الاسم الذي أدخله الضيف.</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>SHA-256 hash لرمز اللاعب الخام. الرمز الخام لا يُخزن أبدًا.</summary>
    public string GuestTokenHash { get; set; } = string.Empty;

    public DateTime GuestTokenExpiresAt { get; set; }

    public DateTime JoinedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public QuizSession? Session { get; set; }

    public Student? Student { get; set; }

    public Attempt? Attempt { get; set; }
}
