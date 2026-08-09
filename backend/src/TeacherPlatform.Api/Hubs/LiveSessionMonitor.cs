using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Infrastructure.Services;
using LiveSessionOptions = TeacherPlatform.Application.Options.SessionOptions;

namespace TeacherPlatform.Api.Hubs;

public sealed class LiveSessionMonitor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<QuizHub> _hub;
    private readonly IOptions<LiveSessionOptions> _options;
    private readonly ILogger<LiveSessionMonitor> _logger;

    public LiveSessionMonitor(
        IServiceScopeFactory scopeFactory,
        IHubContext<QuizHub> hub,
        IOptions<LiveSessionOptions> options,
        ILogger<LiveSessionMonitor> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_options.Value.LiveMonitorIntervalSeconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<LiveSessionService>();
                var closed = await service.CloseExpiredQuestionsAsync(stoppingToken);
                foreach (var state in closed)
                {
                    await PublishAsync(state, LiveEventNames.QuestionClosed, stoppingToken);
                    await PublishAsync(state, LiveEventNames.LeaderboardUpdated, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Live session monitor iteration failed.");
            }
        }
    }

    private async Task PublishAsync(
        LiveSessionStateResponse state,
        string eventName,
        CancellationToken cancellationToken)
    {
        await _hub.Clients.Group(LiveHubGroups.Teachers(state.InternalTenantId, state.SessionId))
            .SendAsync(eventName, state, cancellationToken);
        await _hub.Clients.Group(LiveHubGroups.Players(state.InternalTenantId, state.SessionId))
            .SendAsync(eventName, state, cancellationToken);
    }
}
