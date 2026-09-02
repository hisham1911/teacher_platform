using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class StudentPortalSessionCleanupService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly IOptions<StudentPortalOptions> _options;

    public StudentPortalSessionCleanupService(
        AppDbContext db,
        IClock clock,
        IOptions<StudentPortalOptions> options)
    {
        _db = db;
        _clock = clock;
        _options = options;
    }

    public Task<int> CleanupAsync(CancellationToken cancellationToken)
    {
        var cutoff = _clock.UtcNow.AddDays(-_options.Value.SessionRetentionDays);
        return _db.StudentPortalSessions
            .IgnoreQueryFilters()
            .Where(session =>
                (session.RevokedAt != null && session.RevokedAt < cutoff) ||
                session.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(cancellationToken);
    }
}

public sealed class StudentPortalSessionCleanupWorker : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(24);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StudentPortalSessionCleanupWorker> _logger;

    public StudentPortalSessionCleanupWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<StudentPortalSessionCleanupWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await CleanupOnceAsync(stoppingToken);
        using var timer = new PeriodicTimer(CleanupInterval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await CleanupOnceAsync(stoppingToken);
        }
    }

    private async Task CleanupOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var cleanupService = scope.ServiceProvider.GetRequiredService<StudentPortalSessionCleanupService>();
            var deleted = await cleanupService.CleanupAsync(cancellationToken);
            if (deleted > 0)
            {
                _logger.LogInformation(
                    "Deleted {Count} expired or revoked student portal sessions beyond retention.",
                    deleted);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Student portal session cleanup failed; it will retry on the next interval.");
        }
    }
}
