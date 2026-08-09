using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class OutboxWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptions<CertificateOptions> _options;
    private readonly ILogger<OutboxWorker> _logger;

    public OutboxWorker(
        IServiceScopeFactory scopeFactory,
        IOptions<CertificateOptions> options,
        ILogger<OutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessBatchAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_options.Value.WorkerPollSeconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ProcessBatchAsync(stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<OutboxProcessor>();
            await processor.ProcessBatchAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal host shutdown.
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Outbox worker batch failed; the next poll will retry.");
        }
    }
}
