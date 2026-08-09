using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Saas;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class ReferralService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;

    public ReferralService(AppDbContext db, ITenantContext tenantContext, IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
    }

    public async Task<ReferralCodeResponse> GetOrCreateAsync(Guid ownerUserId, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContext.IsResolved && _tenantContext.TenantId is Guid resolved && resolved != Guid.Empty
            ? resolved
            : throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved.");
        var existing = await _db.ReferralCodes.SingleOrDefaultAsync(code => code.TenantId == tenantId, cancellationToken);
        if (existing is not null) return ToResponse(existing);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            var created = new ReferralCode
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OwnerUserId = ownerUserId,
                Code = Convert.ToHexString(Guid.NewGuid().ToByteArray())[..12],
                IsActive = true,
                CreatedAt = _clock.UtcNow
            };
            _db.ReferralCodes.Add(created);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(created);
            }
            catch (DbUpdateException exception)
                when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                _db.Entry(created).State = EntityState.Detached;
                existing = await _db.ReferralCodes.SingleOrDefaultAsync(
                    code => code.TenantId == tenantId, cancellationToken);
                if (existing is not null) return ToResponse(existing);
            }
        }

        throw new ServiceResultException("Conflict", "Could not allocate a unique referral code. Try again.");
    }

    private static ReferralCodeResponse ToResponse(ReferralCode code) =>
        new()
        {
            Id = code.Id,
            Code = code.Code,
            IsActive = code.IsActive,
            CreatedAt = code.CreatedAt
        };
}
