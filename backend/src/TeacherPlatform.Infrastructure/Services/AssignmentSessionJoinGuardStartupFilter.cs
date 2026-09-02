using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Defense-in-depth at the HTTP boundary: assignment sessions cannot create participants through
/// the generic guest, legacy-student, or generic portal join endpoints. Existing player requests
/// with a guest cookie are untouched, so resume/scoring stay on the current Player engine.
/// </summary>
public sealed class AssignmentSessionJoinGuardStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.UseMiddleware<AssignmentSessionJoinGuardMiddleware>();
        next(app);
    };
}

public sealed class AssignmentSessionJoinGuardMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        if (HttpMethods.IsPost(context.Request.Method) && TryGetJoinCode(context.Request.Path, out var joinCode))
        {
            var managed = await db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
                .AnyAsync(x => x.JoinCode == joinCode && x.AccessKind == SessionAccessKind.ManagedAssignment, context.RequestAborted);
            if (managed)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }
        }
        await next(context);
    }

    private static bool TryGetJoinCode(PathString path, out string joinCode)
    {
        joinCode = string.Empty;
        var segments = path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries) ?? [];
        if (segments.Length != 6 ||
            !segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) ||
            !segments[1].Equals("v1", StringComparison.OrdinalIgnoreCase) ||
            !segments[2].Equals("player", StringComparison.OrdinalIgnoreCase) ||
            !segments[3].Equals("sessions", StringComparison.OrdinalIgnoreCase) ||
            !(segments[5].Equals("join", StringComparison.OrdinalIgnoreCase) || segments[5].Equals("student-join", StringComparison.OrdinalIgnoreCase) || segments[5].Equals("portal-join", StringComparison.OrdinalIgnoreCase)))
            return false;
        joinCode = segments[4].Trim().ToUpperInvariant();
        return joinCode.Length > 0;
    }
}
