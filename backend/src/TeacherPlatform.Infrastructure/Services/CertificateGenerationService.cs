using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class CertificateGenerationService
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly ICertificatePdfRenderer _renderer;
    private readonly IObjectStorage _storage;
    private readonly IClock _clock;

    public CertificateGenerationService(
        AppDbContext db,
        TenantContext tenantContext,
        ICertificatePdfRenderer renderer,
        IObjectStorage storage,
        IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _renderer = renderer;
        _storage = storage;
        _clock = clock;
    }

    public async Task GenerateAsync(Guid tenantId, Guid certificateId, CancellationToken cancellationToken)
    {
        var certificate = await _db.Certificates
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(current =>
                current.Id == certificateId && current.TenantId == tenantId,
                cancellationToken) ?? throw new InvalidOperationException("Certificate record was not found.");

        var passed = await _db.Attempts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(attempt => attempt.Id == certificate.AttemptId && attempt.TenantId == tenantId)
            .Select(attempt => attempt.Passed)
            .SingleOrDefaultAsync(cancellationToken);
        if (passed != true) throw new InvalidOperationException("Certificate attempt is not eligible.");

        var objectKey = $"certificates/{tenantId}/{certificate.Id}.pdf";
        if (!await _storage.ExistsAsync(objectKey, cancellationToken))
        {
            var pdf = _renderer.Render(ToPdfModel(certificate));
            await using var content = new MemoryStream(pdf, writable: false);
            await _storage.UploadAsync(objectKey, content, "application/pdf", cancellationToken);
        }

        using var bootstrap = _tenantContext.BeginBootstrap(tenantId);
        certificate.FileObjectKey = objectKey;
        certificate.Status = CertificateStatus.Ready;
        certificate.FailureReason = null;
        certificate.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkFailedAsync(
        Guid tenantId,
        Guid certificateId,
        string reason,
        CancellationToken cancellationToken)
    {
        var certificate = await _db.Certificates
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(current =>
                current.Id == certificateId && current.TenantId == tenantId,
                cancellationToken);
        if (certificate is null || certificate.Status == CertificateStatus.Ready) return;

        using var bootstrap = _tenantContext.BeginBootstrap(tenantId);
        certificate.Status = CertificateStatus.Failed;
        certificate.FailureReason = reason;
        certificate.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static CertificatePdfModel ToPdfModel(Certificate certificate) => new(
        certificate.StudentName,
        certificate.QuizTitle,
        certificate.Percentage,
        certificate.CertificateNumber,
        certificate.IssuedAt,
        certificate.TitleText,
        certificate.BodyText,
        certificate.IssuerName,
        certificate.PrimaryColor,
        certificate.SecondaryColor);
}
