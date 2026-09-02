using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Enforces explicit workspace suspension across anonymous Player routes and wraps Live joins
/// in the same transaction as the participant insert. MaxLiveParticipants is deliberately
/// Live-only; SelfPaced and ProgressiveChallenge retain the platform-wide session limit.
/// </summary>
public sealed class CommercialPlayerJoinFilter : IAsyncActionFilter
{
    private readonly AppDbContext _db;
    private readonly CommercialPolicyService _commercial;
    private readonly IOptions<SessionOptions> _sessionOptions;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IClock _clock;

    public CommercialPlayerJoinFilter(
        AppDbContext db,
        CommercialPolicyService commercial,
        IOptions<SessionOptions> sessionOptions,
        IOptions<AuthOptions> authOptions,
        IClock clock)
    {
        _db = db;
        _commercial = commercial;
        _sessionOptions = sessionOptions;
        _authOptions = authOptions;
        _clock = clock;
    }

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        context.ActionDescriptor.RouteValues.TryGetValue("controller", out var controller);
        context.ActionDescriptor.RouteValues.TryGetValue("action", out var action);
        if (!string.Equals(controller, "Player", StringComparison.Ordinal))
        {
            await next();
            return;
        }

        if (!context.ActionArguments.TryGetValue("joinCode", out var rawJoinCode)
            || rawJoinCode is not string joinCode)
        {
            await next();
            return;
        }

        var normalized = joinCode.Trim().ToUpperInvariant();
        var session = await _db.QuizSessions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.JoinCode == normalized)
            .Select(item => new { item.Id, item.TenantId, item.Status, item.Mode })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (session is null)
        {
            await next();
            return;
        }

        var tenantStatus = await _db.Tenants
            .AsNoTracking()
            .Where(item => item.Id == session.TenantId)
            .Select(item => (TenantStatus?)item.Status)
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (tenantStatus == TenantStatus.Suspended)
        {
            throw new ServiceResultException(
                "WorkspaceSuspended",
                "This workspace is suspended and cannot serve player activity right now.");
        }

        if (!string.Equals(action, "Join", StringComparison.Ordinal)
            || !HttpMethods.IsPost(context.HttpContext.Request.Method)
            || session.Status != SessionStatus.Active
            || session.Mode != SessionMode.Live)
        {
            await next();
            return;
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(
            context.HttpContext.RequestAborted);
        await _commercial.AcquireCapacityLockAsync(
            session.TenantId,
            CommercialCapacity.LiveParticipants,
            context.HttpContext.RequestAborted,
            session.Id);

        var isIdempotentRejoin = await HasValidExistingParticipantAsync(
            context.HttpContext,
            session.Id,
            session.TenantId,
            context.HttpContext.RequestAborted);
        if (!isIdempotentRejoin)
        {
            var participantCount = await _db.SessionParticipants
                .IgnoreQueryFilters()
                .LongCountAsync(
                    item => item.TenantId == session.TenantId && item.SessionId == session.Id,
                    context.HttpContext.RequestAborted);
            var commercialLimit = await _commercial.GetCapacityLimitAsync(
                session.TenantId,
                CommercialCapacity.LiveParticipants,
                context.HttpContext.RequestAborted);
            var effectiveLimit = Math.Min(
                _sessionOptions.Value.MaxParticipantsPerSession,
                commercialLimit);
            if (participantCount >= effectiveLimit)
            {
                throw new ServiceResultException(
                    "QuotaExceeded",
                    $"This live activity reached the participant limit ({effectiveLimit}). Upgrade the plan to allow more live participants.");
            }
        }

        var executed = await next();
        if (executed.Exception is null || executed.ExceptionHandled)
        {
            await transaction.CommitAsync(context.HttpContext.RequestAborted);
        }
        else
        {
            await transaction.RollbackAsync(context.HttpContext.RequestAborted);
        }
    }

    private async Task<bool> HasValidExistingParticipantAsync(
        HttpContext httpContext,
        Guid sessionId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var cookieName = GuestTokenService.ResolveCookieName(_authOptions.Value.UseSecureCookie);
        if (!httpContext.Request.Cookies.TryGetValue(cookieName, out var rawToken)
            || string.IsNullOrEmpty(rawToken))
        {
            return false;
        }

        var tokenHash = GuestTokenService.ComputeHash(rawToken);
        var now = _clock.UtcNow;
        return await _db.SessionParticipants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(
                item => item.TenantId == tenantId
                    && item.SessionId == sessionId
                    && item.GuestTokenHash == tokenHash
                    && item.GuestTokenExpiresAt > now,
                cancellationToken);
    }
}
