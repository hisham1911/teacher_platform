using TeacherPlatform.Domain.Media;
using TeacherPlatform.Domain.Tenancy;

namespace TeacherPlatform.Domain.Questions;

/// <summary>
/// نسخة محتوى سؤال — Immutable بمجرد إنشائها. لا تُعدَّل ولا تُحذف.
/// أي تعديل على السؤال ينشئ نسخة جديدة برقم أعلى.
/// </summary>
public sealed class QuestionVersion : ITenantEntity
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid QuestionId { get; set; }

    public int VersionNumber { get; set; }

    public QuestionType QuestionType { get; set; }

    public string Prompt { get; set; } = string.Empty;

    public string? Explanation { get; set; }

    public QuestionDifficulty Difficulty { get; set; } = QuestionDifficulty.Medium;

    /// <summary>ar أو en — يحدد اتجاه عرض النص.</summary>
    public string Language { get; set; } = "ar";

    /// <summary>إعدادات نوع السؤال (مثل الإجابات المقبولة للإجابة القصيرة) — JSONB محدود.</summary>
    public string ConfigJson { get; set; } = "{}";

    /// <summary>وسائط السؤال (صورة لأي نوع أو ملف صوتي لسؤال الاستماع).</summary>
    public Guid? MediaAssetId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Question? Question { get; set; }

    public MediaAsset? MediaAsset { get; set; }

    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
}

public enum QuestionDifficulty
{
    Easy = 1,
    Medium = 2,
    Hard = 3
}
