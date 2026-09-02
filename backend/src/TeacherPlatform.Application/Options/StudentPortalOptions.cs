using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

public sealed class StudentPortalOptions
{
    public const string SectionName = "StudentPortal";

    /// <summary>Kill switch للبوابة الدائمة. Quick Join القديم لا يعتمد عليه.</summary>
    public bool Enabled { get; set; } = false;

    [Range(1, 180)]
    public int SessionDays { get; set; } = 30;

    [Range(12, 24)]
    public int AccessCodeLength { get; set; } = 16;

    [Range(60, 90)]
    public int SessionRetentionDays { get; set; } = 90;

    [Required, StringLength(80, MinimumLength = 3)]
    public string CookieName { get; set; } = "tp-student";
}
