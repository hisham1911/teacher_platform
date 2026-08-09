using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Operations;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class OutboxProcessor
{
    private readonly AppDbContext _db;
    private readonly TenantContext _tenantContext;
    private readonly CertificateGenerationService _certificateGeneration;
    private readonly IOptions<CertificateOptions> _options;
    private readonly ILogger<OutboxProcessor> _logger;
    private readonly IClock _clock;
    private readonly string _workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}";

    public OutboxProcessor(
        AppDbContext db,
        TenantContext tenantContext,
        CertificateGenerationService certificateGeneration,
        IOptions<CertificateOptions> options,
        ILogger<OutboxProcessor> logger,
        IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _certificateGeneration = certificateGeneration;
        _options = options;
        _logger = logger;
        _clock = clock;
    }

    public async Task<int> ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var processed = 0;
        while (processed < 10 && await TryProcessNextAsync(cancellationToken)) processed++;
        return processed;
    }

    private async Task<bool> TryProcessNextAsync(CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var candidate = await _db.OutboxMessages
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(message =>
                message.ProcessedAt == null &&
                message.AttemptCount < _options.Value.MaxProcessingAttempts &&
                message.NextAttemptAt <= now &&
                (message.LockedUntil == null || message.LockedUntil < now))
            .OrderBy(message => message.NextAttemptAt)
            .Select(message => new { message.Id, message.TenantId })
            .FirstOrDefaultAsync(cancellationToken);
        if (candidate is null) return false;

        var lockUntil = now.AddSeconds(_options.Value.ProcessingLockSeconds);
        var claimed = await _db.OutboxMessages
            .IgnoreQueryFilters()
            .Where(message =>
                message.Id == candidate.Id &&
                message.ProcessedAt == null &&
                (message.LockedUntil == null || message.LockedUntil < now))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(message => message.LockedUntil, lockUntil)
                .SetProperty(message => message.LockOwner, _workerId), cancellationToken);
        if (claimed == 0) return true;

        var message = await _db.OutboxMessages
            .IgnoreQueryFilters()
            .SingleAsync(current => current.Id == candidate.Id, cancellationToken);
        try
        {
            await DispatchAsync(message, cancellationToken);
            using var bootstrap = _tenantContext.BeginBootstrap(message.TenantId);
            message.ProcessedAt = _clock.UtcNow;
            message.LockedUntil = null;
            message.LockOwner = null;
            message.LastError = null;
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(exception,
                "Outbox message failed. MessageId={MessageId} Type={MessageType} Attempt={Attempt}",
                message.Id, message.MessageType, message.AttemptCount + 1);
            await RecordFailureAsync(message, exception, cancellationToken);
        }

        return true;
    }

    private async Task DispatchAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        if (message.MessageType != CertificateService.GenerationMessageType)
        {
            throw new InvalidOperationException($"Unsupported outbox message type: {message.MessageType}");
        }

        var payload = JsonSerializer.Deserialize<CertificateGenerationPayload>(message.PayloadJson)
            ?? throw new InvalidOperationException("Certificate generation payload is invalid.");
        await _certificateGeneration.GenerateAsync(message.TenantId, payload.CertificateId, cancellationToken);
    }

    private async Task RecordFailureAsync(
        OutboxMessage failedMessage,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _db.ChangeTracker.Clear();
        var message = await _db.OutboxMessages
            .IgnoreQueryFilters()
            .SingleAsync(current => current.Id == failedMessage.Id, cancellationToken);
        var attemptCount = message.AttemptCount + 1;
        using var bootstrap = _tenantContext.BeginBootstrap(message.TenantId);
        message.AttemptCount = attemptCount;
        message.LastError = exception.GetType().Name;
        message.LockedUntil = null;
        message.LockOwner = null;
        message.NextAttemptAt = _clock.UtcNow.AddSeconds(Math.Min(300, Math.Pow(2, attemptCount) * 5));
        await _db.SaveChangesAsync(cancellationToken);

        if (attemptCount >= _options.Value.MaxProcessingAttempts && message.AggregateId.HasValue)
        {
            await _certificateGeneration.MarkFailedAsync(
                message.TenantId,
                message.AggregateId.Value,
                "تعذر توليد ملف الشهادة بعد عدة محاولات. يمكن للمعلم إعادة المحاولة.",
                cancellationToken);
        }
    }
}
