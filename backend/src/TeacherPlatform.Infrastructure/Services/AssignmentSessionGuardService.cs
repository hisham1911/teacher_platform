using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Domain.Sessions;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class AssignmentSessionGuardService
{
    private readonly AppDbContext _db;
    public AssignmentSessionGuardService(AppDbContext db) => _db = db;

    public async Task EnsureGuestJoinAllowedAsync(string joinCode, CancellationToken cancellationToken)
    {
        var normalized = joinCode.Trim().ToUpperInvariant();
        var accessKind = await _db.QuizSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.JoinCode == normalized)
            .Select(x => (SessionAccessKind?)x.AccessKind)
            .SingleOrDefaultAsync(cancellationToken);
        if (accessKind == SessionAccessKind.ManagedAssignment)
            throw new ServiceResultException("NotFound", "Activity not found.");
    }
}
