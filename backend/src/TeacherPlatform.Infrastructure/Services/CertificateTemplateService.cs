using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class CertificateTemplateService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly ITenantContext _tenantContext;

    public CertificateTemplateService(AppDbContext db, IClock clock, ITenantContext tenantContext)
    {
        _db = db;
        _clock = clock;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<CertificateTemplateResponse>> ListAsync(CancellationToken cancellationToken)
    {
        RequireTenantId();
        return await _db.CertificateTemplates
            .AsNoTracking()
            .OrderByDescending(template => template.IsDefault)
            .ThenBy(template => template.Name)
            .Select(template => Map(template))
            .ToListAsync(cancellationToken);
    }

    public async Task<(ServiceResultException? Error, CertificateTemplateResponse? Result)> CreateAsync(
        SaveCertificateTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var hasDefault = await _db.CertificateTemplates.AnyAsync(template => template.IsDefault, cancellationToken);
        var template = BuildTemplate(request, _clock.UtcNow, request.IsDefault || !hasDefault);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (template.IsDefault)
        {
            await ClearDefaultAsync(tenantId, null, cancellationToken);
        }

        _db.CertificateTemplates.Add(template);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsTemplateNameConflict(exception))
        {
            return (new ServiceResultException("Conflict", "A certificate template with this name already exists."), null);
        }

        return (null, Map(template));
    }

    public async Task<(ServiceResultException? Error, CertificateTemplateResponse? Result)> UpdateAsync(
        Guid templateId,
        SaveCertificateTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();
        var template = await _db.CertificateTemplates.SingleOrDefaultAsync(current => current.Id == templateId, cancellationToken);
        if (template is null)
        {
            return (new ServiceResultException("NotFound", "Certificate template not found."), null);
        }

        if (!request.BaseVersion.HasValue || template.Version != request.BaseVersion.Value)
        {
            return (new ServiceResultException("Conflict", "The certificate template was modified by someone else."), null);
        }

        if (template.IsDefault && !request.IsDefault)
        {
            return (new ServiceResultException("DefaultTemplateRequired", "Set another template as default before changing this one."), null);
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (request.IsDefault && !template.IsDefault)
        {
            await ClearDefaultAsync(tenantId, template.Id, cancellationToken);
        }

        Apply(template, request, _clock.UtcNow);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsTemplateNameConflict(exception))
        {
            return (new ServiceResultException("Conflict", "A certificate template with this name already exists."), null);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The certificate template was modified by someone else."), null);
        }

        return (null, Map(template));
    }

    public async Task<CertificateTemplate> GetOrCreateDefaultAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var existing = await _db.CertificateTemplates
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(template => template.TenantId == tenantId && template.IsDefault, cancellationToken);
        if (existing is not null) return existing;

        var issuerName = await _db.TenantSettings
            .AsNoTracking()
            .Where(settings => settings.TenantId == tenantId)
            .Select(settings => settings.PublicTeacherName)
            .SingleOrDefaultAsync(cancellationToken);
        issuerName ??= await _db.Tenants
            .AsNoTracking()
            .Where(tenant => tenant.Id == tenantId)
            .Select(tenant => tenant.Name)
            .SingleAsync(cancellationToken);

        var now = _clock.UtcNow;
        var template = new CertificateTemplate
        {
            Id = Guid.NewGuid(),
            Name = "القالب الافتراضي",
            TitleText = "شهادة اجتياز",
            BodyText = "تُمنح هذه الشهادة تقديرًا لإتمام الاختبار بنجاح",
            IssuerName = issuerName,
            PrimaryColor = "#0F766E",
            SecondaryColor = "#D97706",
            IsDefault = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.CertificateTemplates.Add(template);
        return template;
    }

    private async Task ClearDefaultAsync(Guid tenantId, Guid? excludedId, CancellationToken cancellationToken)
    {
        var defaults = await _db.CertificateTemplates
            .Where(template => template.TenantId == tenantId && template.IsDefault && template.Id != excludedId)
            .ToListAsync(cancellationToken);
        foreach (var template in defaults)
        {
            template.IsDefault = false;
            template.UpdatedAt = _clock.UtcNow;
        }
    }

    private static CertificateTemplate BuildTemplate(
        SaveCertificateTemplateRequest request,
        DateTime now,
        bool isDefault)
    {
        var template = new CertificateTemplate
        {
            Id = Guid.NewGuid(),
            IsDefault = isDefault,
            CreatedAt = now
        };
        Apply(template, request, now);
        return template;
    }

    private static void Apply(CertificateTemplate template, SaveCertificateTemplateRequest request, DateTime now)
    {
        template.Name = request.Name.Trim();
        template.TitleText = request.TitleText.Trim();
        template.BodyText = request.BodyText.Trim();
        template.IssuerName = request.IssuerName.Trim();
        template.PrimaryColor = request.PrimaryColor.ToUpperInvariant();
        template.SecondaryColor = request.SecondaryColor.ToUpperInvariant();
        template.IsDefault = request.IsDefault || template.IsDefault;
        template.UpdatedAt = now;
    }

    private static CertificateTemplateResponse Map(CertificateTemplate template) => new()
    {
        Id = template.Id,
        Name = template.Name,
        TitleText = template.TitleText,
        BodyText = template.BodyText,
        IssuerName = template.IssuerName,
        PrimaryColor = template.PrimaryColor,
        SecondaryColor = template.SecondaryColor,
        IsDefault = template.IsDefault,
        Version = template.Version,
        UpdatedAt = template.UpdatedAt
    };

    private static bool IsTemplateNameConflict(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_CertificateTemplates_TenantId_Name"
        };

    private Guid RequireTenantId() => _tenantContext.TenantId is { } tenantId && tenantId != TenantContext.UnresolvedTenantId
        ? tenantId
        : throw new ServiceResultException("Forbidden", "A tenant context is required.");
}
