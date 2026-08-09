using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Options;

public sealed class CertificateOptions
{
    public const string SectionName = "Certificates";

    public string QuestPdfLicense { get; set; } = string.Empty;

    [Required]
    public string WindowsFontFamily { get; set; } = "Arial";

    [Required]
    public string LinuxFontFamily { get; set; } = "DejaVu Sans";

    [Range(1, 30)]
    public int ParentShareDays { get; set; } = 7;

    [Range(1, 60)]
    public int WorkerPollSeconds { get; set; } = 5;

    [Range(1, 20)]
    public int MaxProcessingAttempts { get; set; } = 5;

    [Range(10, 300)]
    public int ProcessingLockSeconds { get; set; } = 60;
}
