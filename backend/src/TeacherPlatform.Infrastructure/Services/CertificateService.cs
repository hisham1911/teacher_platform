using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Operations;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class CertificateService
{
    public const string GenerationMessageType = "CertificateGenerationRequested";

    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly TenantContext _tenantContext;
    private readonly PlayerAttemptAccessService _playerAccess;
    private readonly CertificateTemplateService _templateService;
    private readonly IObjectStorage _storage;
    private readonly IDataProtector _tokenProtector;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly PlanLimitResolver _planLimits;

    public CertificateService(
        AppDbContext db,
        IClock clock,
        TenantContext tenantContext,
        PlayerAttemptAccessService playerAccess,
        CertificateTemplateService templateService,
        IObjectStorage storage,
        IDataProtectionProvider dataProtectionProvider,
        IOptions<AuthOptions> authOptions,
        PlanLimitResolver planLimits)
    {
        _db = db;
        _clock = clock;
        _tenantContext = tenantContext;
        _playerAccess = playerAccess;
        _templateService = templateService;
        _storage = storage;
        _tokenProtector = dataProtectionProvider.CreateProtector("TeacherPlatform.CertificatePublicToken.v1");
        _authOptions = authOptions;
        _planLimits = planLimits;
    }

    public async Task<(ServiceResultException? Error, PlayerCertificateResponse? Result)> GetOrCreateForPlayerAsync(
        string joinCode,
        Guid attemptId,
        string rawGuestToken,
        CancellationToken cancellationToken)
    {
        var resolved = await _playerAccess.ResolveCompletedAsync(joinCode, attemptId, rawGuestToken, cancellationToken);
        if (resolved.Error is not null || resolved.Access is null) return (resolved.Error, null);
        if (resolved.Access.Attempt.Passed != true)
        {
            return (new ServiceResultException("CertificateNotEligible", "Certificates are issued only for passed attempts."), null);
        }

        var tenantId = resolved.Access.Session.TenantId;
        var existingCertificate = await FindByAttemptAsync(tenantId, attemptId, cancellationToken);
        if (existingCertificate is not null) return (null, MapPlayer(existingCertificate, joinCode, attemptId));

        var limits = await _planLimits.GetAsync(tenantId, cancellationToken);
        var now = _clock.UtcNow;
        var periodStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var issuedCount = await _db.Certificates.IgnoreQueryFilters().CountAsync(
            certificate => certificate.TenantId == tenantId && certificate.IssuedAt >= periodStart,
            cancellationToken);
        if (issuedCount >= limits.MaxCertificatesPerMonth)
        {
            return (new ServiceResultException("QuotaExceeded", "This workspace reached its monthly certificate limit."), null);
        }

        for (var tryNumber = 0; tryNumber < 2; tryNumber++)
        {
            var existing = await FindByAttemptAsync(resolved.Access.Session.TenantId, attemptId, cancellationToken);
            if (existing is not null) return (null, MapPlayer(existing, joinCode, attemptId));

            var created = await TryCreateAsync(resolved.Access, cancellationToken);
            if (created is not null) return (null, MapPlayer(created, joinCode, attemptId));
        }

        return (new ServiceResultException("Conflict", "Certificate issuance conflicted with another request. Try again."), null);
    }

    public async Task<IReadOnlyList<CertificateListItemResponse>> ListAsync(CancellationToken cancellationToken)
    {
        RequireTenantId();
        var certificates = await _db.Certificates
            .AsNoTracking()
            .OrderByDescending(certificate => certificate.IssuedAt)
            .Take(500)
            .ToListAsync(cancellationToken);
        return certificates.Select(MapListItem).ToList();
    }

    public async Task<(ServiceResultException? Error, CertificateListItemResponse? Result)> RetryAsync(
        Guid certificateId,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var certificate = await _db.Certificates.SingleOrDefaultAsync(current => current.Id == certificateId, cancellationToken);
        if (certificate is null)
        {
            return (new ServiceResultException("NotFound", "Certificate not found."), null);
        }

        if (certificate.Status == CertificateStatus.Ready) return (null, MapListItem(certificate));

        var outbox = await _db.OutboxMessages
            .Where(message =>
                message.TenantId == tenantId &&
                message.MessageType == GenerationMessageType &&
                message.AggregateId == certificate.Id &&
                message.ProcessedAt == null)
            .OrderByDescending(message => message.OccurredAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (outbox is null)
        {
            _db.OutboxMessages.Add(BuildOutbox(certificate.Id, _clock.UtcNow));
        }
        else
        {
            outbox.AttemptCount = 0;
            outbox.NextAttemptAt = _clock.UtcNow;
            outbox.LockedUntil = null;
            outbox.LockOwner = null;
            outbox.LastError = null;
        }

        certificate.Status = CertificateStatus.Pending;
        certificate.FailureReason = null;
        certificate.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return (null, MapListItem(certificate));
    }

    public async Task<(ServiceResultException? Error, (string FileName, Stream Content)? File)> OpenForPlayerAsync(
        string joinCode,
        Guid attemptId,
        string rawGuestToken,
        CancellationToken cancellationToken)
    {
        var resolved = await _playerAccess.ResolveCompletedAsync(joinCode, attemptId, rawGuestToken, cancellationToken);
        if (resolved.Error is not null || resolved.Access is null) return (resolved.Error, null);
        var certificate = await FindByAttemptAsync(resolved.Access.Session.TenantId, attemptId, cancellationToken);
        return await OpenFileAsync(certificate, cancellationToken);
    }

    public async Task<(ServiceResultException? Error, (string FileName, Stream Content)? File)> OpenForTeacherAsync(
        Guid certificateId,
        CancellationToken cancellationToken)
    {
        RequireTenantId();
        var certificate = await _db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(current => current.Id == certificateId, cancellationToken);
        return await OpenFileAsync(certificate, cancellationToken);
    }

    public async Task<(ServiceResultException? Error, (string FileName, Stream Content)? File)> OpenPublicAsync(
        string publicToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(publicToken))
        {
            return (new ServiceResultException("NotFound", "Certificate not found."), null);
        }

        var tokenHash = GuestTokenService.ComputeHash(publicToken);
        var certificate = await _db.Certificates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(current => current.PublicTokenHash == tokenHash, cancellationToken);
        return await OpenFileAsync(certificate, cancellationToken);
    }

    public string? GetPublicUrl(Certificate? certificate)
    {
        if (certificate is null || certificate.Status != CertificateStatus.Ready) return null;
        var rawToken = _tokenProtector.Unprotect(certificate.PublicTokenProtected);
        return $"{_authOptions.Value.WebBaseUrl.TrimEnd('/')}/certificate/{rawToken}";
    }

    private async Task<Certificate?> TryCreateAsync(PlayerAttemptAccess access, CancellationToken cancellationToken)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        using var bootstrap = _tenantContext.BeginBootstrap(access.Session.TenantId);
        try
        {
            var template = await _templateService.GetOrCreateDefaultAsync(access.Session.TenantId, cancellationToken);
            var rawPublicToken = GuestTokenService.GenerateRawToken();
            var now = _clock.UtcNow;
            var certificate = new Certificate
            {
                Id = Guid.NewGuid(),
                AttemptId = access.Attempt.Id,
                TemplateId = template.Id,
                CertificateNumber = BuildCertificateNumber(now),
                PublicTokenHash = GuestTokenService.ComputeHash(rawPublicToken),
                PublicTokenProtected = _tokenProtector.Protect(rawPublicToken),
                Status = CertificateStatus.Pending,
                IssuedAt = now,
                StudentName = access.Participant.DisplayName,
                QuizTitle = access.Session.Quiz?.Title ?? string.Empty,
                Percentage = access.Attempt.Percentage ?? 0m,
                TitleText = template.TitleText,
                BodyText = template.BodyText,
                IssuerName = template.IssuerName,
                PrimaryColor = template.PrimaryColor,
                SecondaryColor = template.SecondaryColor,
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.Certificates.Add(certificate);
            _db.OutboxMessages.Add(BuildOutbox(certificate.Id, now));
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return certificate;
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await transaction.RollbackAsync(cancellationToken);
            _db.ChangeTracker.Clear();
            return null;
        }
    }

    private async Task<Certificate?> FindByAttemptAsync(
        Guid tenantId,
        Guid attemptId,
        CancellationToken cancellationToken) =>
        await _db.Certificates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(certificate =>
                certificate.TenantId == tenantId && certificate.AttemptId == attemptId,
                cancellationToken);

    private async Task<(ServiceResultException? Error, (string FileName, Stream Content)? File)> OpenFileAsync(
        Certificate? certificate,
        CancellationToken cancellationToken)
    {
        if (certificate is null)
        {
            return (new ServiceResultException("NotFound", "Certificate not found."), null);
        }

        if (certificate.Status != CertificateStatus.Ready || string.IsNullOrWhiteSpace(certificate.FileObjectKey))
        {
            return (new ServiceResultException("CertificateNotReady", "Certificate generation is still pending."), null);
        }

        var content = await _storage.OpenReadAsync(certificate.FileObjectKey, cancellationToken);
        return (null, ($"certificate-{certificate.CertificateNumber}.pdf", content));
    }

    private PlayerCertificateResponse MapPlayer(Certificate certificate, string joinCode, Guid attemptId)
    {
        var ready = certificate.Status == CertificateStatus.Ready;
        var rawToken = _tokenProtector.Unprotect(certificate.PublicTokenProtected);
        return new PlayerCertificateResponse
        {
            CertificateId = certificate.Id,
            CertificateNumber = certificate.CertificateNumber,
            Status = certificate.Status.ToString(),
            IssuedAt = certificate.IssuedAt,
            DownloadUrl = ready
                ? $"/api/v1/player/sessions/{Uri.EscapeDataString(joinCode)}/attempts/{attemptId}/certificate/file"
                : null,
            PublicUrl = $"{_authOptions.Value.WebBaseUrl.TrimEnd('/')}/certificate/{rawToken}"
        };
    }

    private CertificateListItemResponse MapListItem(Certificate certificate) => new()
    {
        Id = certificate.Id,
        AttemptId = certificate.AttemptId,
        CertificateNumber = certificate.CertificateNumber,
        StudentName = certificate.StudentName,
        QuizTitle = certificate.QuizTitle,
        Percentage = certificate.Percentage,
        Status = certificate.Status.ToString(),
        IssuedAt = certificate.IssuedAt,
        FailureReason = certificate.FailureReason,
        PublicUrl = GetPublicUrl(certificate)
    };

    private static OutboxMessage BuildOutbox(Guid certificateId, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        MessageType = GenerationMessageType,
        AggregateId = certificateId,
        PayloadJson = JsonSerializer.Serialize(new CertificateGenerationPayload(certificateId)),
        OccurredAt = now,
        NextAttemptAt = now,
        CreatedAt = now,
        UpdatedAt = now
    };

    private static string BuildCertificateNumber(DateTime issuedAt) =>
        $"CERT-{issuedAt.Year}-{GuestTokenService.GenerateJoinCode(12)}";

    private Guid RequireTenantId() => _tenantContext.TenantId is { } tenantId && tenantId != TenantContext.UnresolvedTenantId
        ? tenantId
        : throw new ServiceResultException("Forbidden", "A tenant context is required.");
}
