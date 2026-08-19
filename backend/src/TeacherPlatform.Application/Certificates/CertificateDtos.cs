using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Certificates;

public sealed class CertificateTemplateResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TitleText { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string IssuerName { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string SecondaryColor { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public uint Version { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class SaveCertificateTemplateRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string TitleText { get; set; } = string.Empty;

    [Required, StringLength(500, MinimumLength = 1)]
    public string BodyText { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string IssuerName { get; set; } = string.Empty;

    [Required, RegularExpression("^#[0-9A-Fa-f]{6}$")]
    public string PrimaryColor { get; set; } = "#0F766E";

    [Required, RegularExpression("^#[0-9A-Fa-f]{6}$")]
    public string SecondaryColor { get; set; } = "#D97706";

    public bool IsDefault { get; set; }

    public uint? BaseVersion { get; set; }
}

public sealed class CertificateListItemResponse
{
    public Guid Id { get; set; }
    public Guid AttemptId { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string QuizTitle { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public string? FailureReason { get; set; }
    public string? PublicUrl { get; set; }
}

public sealed class PlayerCertificateResponse
{
    public Guid CertificateId { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public string? DownloadUrl { get; set; }
    public string? PublicUrl { get; set; }
}

public sealed class ParentShareResponse
{
    public string ShareUrl { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public sealed class PublicResultResponse
{
    public string StudentName { get; set; } = string.Empty;
    public string QuizTitle { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public decimal MaxScore { get; set; }
    public decimal Percentage { get; set; }
    public bool Passed { get; set; }
    public DateTime FinishedAt { get; set; }
    public IReadOnlyList<string> ReviewAreas { get; set; } = [];
    public string? CertificateUrl { get; set; }
}

public sealed record CertificateGenerationPayload(Guid CertificateId);

public sealed record CertificatePdfModel(
    string StudentName,
    string QuizTitle,
    decimal Percentage,
    string CertificateNumber,
    DateTime IssuedAt,
    string TitleText,
    string BodyText,
    string IssuerName,
    string PrimaryColor,
    string SecondaryColor);
