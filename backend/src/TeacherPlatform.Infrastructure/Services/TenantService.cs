using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class TenantService
{
    private readonly AppDbContext _db;
    private readonly TenantBypassService _bypass;
    private readonly TenantContext _tenantContext;
    private readonly AuthOptions _authOptions;
    private readonly CommercialPolicyService _commercial;

    public TenantService(
        AppDbContext db,
        TenantBypassService bypass,
        ITenantContext tenantContext,
        IOptions<AuthOptions> authOptions,
        CommercialPolicyService commercial)
    {
        _db = db;
        _bypass = bypass;
        _tenantContext = (TenantContext)tenantContext;
        _authOptions = authOptions.Value;
        _commercial = commercial;
    }

    public async Task<(ServiceResultException? Error, TenantDetailResponse? Result)> CreateTenantAsync(
        CreateTenantRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        if (!TenantSlugNormalizer.IsUrlSafe(request.Slug))
            return (new ServiceResultException("InvalidSlug", "Slug must be URL-safe (letters, digits, hyphen, underscore)."), null);

        var normalized = TenantSlugNormalizer.Normalize(request.Slug);
        if (await _bypass.SlugExistsAsync(normalized, excludingTenantId: null, cancellationToken))
            return (new ServiceResultException("SlugConflict", "A workspace with this slug already exists."), null);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Slug = request.Slug.Trim(),
            NormalizedSlug = normalized,
            OwnerUserId = currentUserId,
            CountryCode = request.CountryCode.Trim().ToUpperInvariant(),
            Timezone = request.Timezone.Trim(),
            DefaultLocale = request.DefaultLocale.Trim(),
            Status = TenantStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(cancellationToken);

        using var bootstrap = _tenantContext.BeginBootstrap(tenant.Id);
        var membership = new TenantMembership
        {
            Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = currentUserId,
            Role = TenantMemberRole.Owner, Status = TenantMembershipStatus.Active,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        _db.TenantMemberships.Add(membership);
        var settings = new TenantSettings
        {
            TenantId = tenant.Id, SettingsJson = "{}", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        _db.TenantSettings.Add(settings);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (null, ToDetail(tenant, TenantMemberRole.Owner, settings));
    }

    public async Task<IReadOnlyList<TenantDetailResponse>> ListMineAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await _bypass.ListActiveMembershipsForUserAsync(userId, cancellationToken);
        var list = new List<TenantDetailResponse>();
        foreach (var membership in memberships)
        {
            // Suspended workspaces stay visible in the switcher so the user understands why access is blocked.
            var settings = await _bypass.FindSettingsIgnoreFiltersAsync(membership.TenantId, cancellationToken);
            list.Add(ToDetail(membership.Tenant!, membership.Role, settings));
        }
        return list;
    }

    public async Task<TenantDetailResponse?> GetAsync(Guid tenantId, TenantMemberRole myRole, CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null) return null;
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return ToDetail(tenant, myRole, settings);
    }

    public async Task<(ServiceResultException? Error, TenantDetailResponse? Result)> UpdateAsync(
        Guid tenantId, UpdateTenantRequest request, TenantMemberRole myRole, CancellationToken cancellationToken)
    {
        if (!TenantSlugNormalizer.IsUrlSafe(request.Slug))
            return (new ServiceResultException("InvalidSlug", "Slug must be URL-safe."), null);

        var tenant = await _db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null) return (new ServiceResultException("NotFound", "Workspace not found."), null);
        var normalized = TenantSlugNormalizer.Normalize(request.Slug);
        if (await _bypass.SlugExistsAsync(normalized, tenantId, cancellationToken))
            return (new ServiceResultException("SlugConflict", "A workspace with this slug already exists."), null);

        tenant.Name = request.Name.Trim();
        tenant.Slug = request.Slug.Trim();
        tenant.NormalizedSlug = normalized;
        tenant.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return (null, ToDetail(tenant, myRole, settings));
    }

    public async Task<IReadOnlyList<TenantMemberDto>> ListMembersAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var memberships = await _db.TenantMemberships.Where(m => m.TenantId == tenantId).ToListAsync(cancellationToken);
        var result = new List<TenantMemberDto>();
        foreach (var membership in memberships)
        {
            var user = await _db.Users.SingleOrDefaultAsync(u => u.Id == membership.UserId, cancellationToken);
            var profile = await _db.UserProfiles.SingleOrDefaultAsync(p => p.UserId == membership.UserId, cancellationToken);
            result.Add(new TenantMemberDto
            {
                UserId = membership.UserId, Role = membership.Role.ToString(), Status = membership.Status.ToString(),
                Email = user?.Email ?? string.Empty, FullName = profile?.FullName ?? string.Empty
            });
        }
        return result;
    }

    public async Task<(ServiceResultException? Error, TenantMemberDto? Result)> AddMemberAsync(
        Guid tenantId, AddTenantMemberRequest request, CancellationToken cancellationToken)
    {
        if (!TryParseRole(request.Role, out var role))
            return (new ServiceResultException("InvalidRole", "Role must be Teacher, Assistant, or Viewer."), null);

        var memberUser = await _db.Users.SingleOrDefaultAsync(u => u.Email == request.Email, cancellationToken);
        if (memberUser is null)
            return (new ServiceResultException("UserNotFound", "The specified user is not available."), null);
        if (await _bypass.IsPlatformAdminAsync(memberUser.Id, cancellationToken))
            return (new ServiceResultException("InvalidRole", "This user cannot be added as a tenant member."), null);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _commercial.AcquireCapacityLockAsync(tenantId, CommercialCapacity.Members, cancellationToken);

        if (await _db.TenantMemberships.AnyAsync(m => m.TenantId == tenantId && m.UserId == memberUser.Id, cancellationToken))
            return (new ServiceResultException("DuplicateMember", "User is already a member of this workspace."), null);

        var activeMemberCount = await _db.TenantMemberships.LongCountAsync(
            m => m.TenantId == tenantId && m.Status == TenantMembershipStatus.Active, cancellationToken);
        await _commercial.EnsureCapacityAsync(tenantId, CommercialCapacity.Members, activeMemberCount, cancellationToken);

        var membership = new TenantMembership
        {
            Id = Guid.NewGuid(), TenantId = tenantId, UserId = memberUser.Id, Role = role,
            Status = TenantMembershipStatus.Active, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        _db.TenantMemberships.Add(membership);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return (new ServiceResultException("DuplicateMember", "User is already a member of this workspace."), null);
        }

        var profile = await _db.UserProfiles.SingleOrDefaultAsync(p => p.UserId == memberUser.Id, cancellationToken);
        return (null, new TenantMemberDto
        {
            UserId = memberUser.Id, Email = memberUser.Email ?? string.Empty, FullName = profile?.FullName ?? string.Empty,
            Role = membership.Role.ToString(), Status = membership.Status.ToString()
        });
    }

    public async Task<TenantSettingsResponse?> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return settings is null ? null : ToSettingsDto(settings);
    }

    public async Task<(ServiceResultException? Error, TenantSettingsResponse? Result)> UpdateSettingsAsync(
        Guid tenantId, UpdateTenantSettingsRequest request, CancellationToken cancellationToken)
    {
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        if (settings is null) return (new ServiceResultException("NotFound", "Settings not found."), null);

        if (HasBrandingMutation(request))
            await _commercial.RequireEntitlementAsync(tenantId, CommercialEntitlements.CustomBranding, cancellationToken);

        if (request.SettingsJson is not null)
        {
            var safeJsonError = ValidateSafeSettingsJson(request.SettingsJson);
            if (safeJsonError is not null) return (safeJsonError, null);
            settings.SettingsJson = request.SettingsJson;
        }
        if (request.LogoObjectKey is not null) settings.LogoObjectKey = NormalizeOptional(request.LogoObjectKey);
        if (request.PrimaryColor is not null) settings.PrimaryColor = request.PrimaryColor;
        if (request.SecondaryColor is not null) settings.SecondaryColor = request.SecondaryColor;
        if (request.PublicTeacherName is not null) settings.PublicTeacherName = NormalizeOptional(request.PublicTeacherName);
        if (request.CertificateSignatureObjectKey is not null) settings.CertificateSignatureObjectKey = NormalizeOptional(request.CertificateSignatureObjectKey);

        ApplyControlledBranding(settings, request);
        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return (null, ToSettingsDto(settings));
    }

    public Task<TenantMembership?> GetMembershipAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken) =>
        _bypass.FindMembershipIgnoreFiltersAsync(tenantId, userId, cancellationToken);

    private static bool HasBrandingMutation(UpdateTenantSettingsRequest request) =>
        request.LogoObjectKey is not null || request.PrimaryColor is not null || request.SecondaryColor is not null ||
        request.PublicTeacherName is not null || request.BrandDisplayName is not null ||
        request.StudentPortalWelcomeText is not null || request.SupportContact is not null;

    private static ServiceResultException? ValidateSafeSettingsJson(string json)
    {
        try
        {
            if (JsonNode.Parse(json) is not JsonObject) return new ServiceResultException("ValidationError", "SettingsJson must be a JSON object.");
        }
        catch (JsonException)
        {
            return new ServiceResultException("ValidationError", "SettingsJson is invalid JSON.");
        }
        var lowered = json.ToLowerInvariant();
        if (lowered.Contains("<script", StringComparison.Ordinal) || lowered.Contains("<style", StringComparison.Ordinal)
            || lowered.Contains("javascript:", StringComparison.Ordinal) || lowered.Contains("\"css\"", StringComparison.Ordinal)
            || lowered.Contains("\"html\"", StringComparison.Ordinal))
        {
            return new ServiceResultException("ValidationError", "Executable HTML/CSS/JavaScript settings are not allowed.");
        }
        return null;
    }

    private static void ApplyControlledBranding(TenantSettings settings, UpdateTenantSettingsRequest request)
    {
        if (request.BrandDisplayName is null && request.StudentPortalWelcomeText is null && request.SupportContact is null) return;
        var root = JsonNode.Parse(settings.SettingsJson) as JsonObject ?? new JsonObject();
        var branding = root["commercialBranding"] as JsonObject ?? new JsonObject();
        if (request.BrandDisplayName is not null) branding["brandDisplayName"] = NormalizeOptional(request.BrandDisplayName);
        if (request.StudentPortalWelcomeText is not null) branding["studentPortalWelcomeText"] = NormalizeOptional(request.StudentPortalWelcomeText);
        if (request.SupportContact is not null) branding["supportContact"] = NormalizeOptional(request.SupportContact);
        root["commercialBranding"] = branding;
        settings.SettingsJson = root.ToJsonString(new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }

    private static (string? BrandDisplayName, string? WelcomeText, string? SupportContact) ReadControlledBranding(string json)
    {
        try
        {
            var branding = (JsonNode.Parse(json) as JsonObject)?["commercialBranding"] as JsonObject;
            return (
                branding?["brandDisplayName"]?.GetValue<string?>(),
                branding?["studentPortalWelcomeText"]?.GetValue<string?>(),
                branding?["supportContact"]?.GetValue<string?>());
        }
        catch (JsonException) { return (null, null, null); }
    }

    private static bool TryParseRole(string raw, out TenantMemberRole role)
    {
        role = TenantMemberRole.Viewer;
        if (!Enum.TryParse<TenantMemberRole>(raw, ignoreCase: true, out var parsed) || parsed is TenantMemberRole.Owner) return false;
        role = parsed;
        return true;
    }

    private static TenantDetailResponse ToDetail(Tenant tenant, TenantMemberRole role, TenantSettings? settings) => new()
    {
        Id = tenant.Id, Name = tenant.Name, Slug = tenant.Slug, CountryCode = tenant.CountryCode,
        Timezone = tenant.Timezone, DefaultLocale = tenant.DefaultLocale, Status = tenant.Status.ToString(),
        MyRole = role.ToString(), Settings = ToSettingsDto(settings ?? new TenantSettings { TenantId = tenant.Id })
    };

    private static TenantSettingsResponse ToSettingsDto(TenantSettings settings)
    {
        var branding = ReadControlledBranding(settings.SettingsJson);
        return new TenantSettingsResponse
        {
            LogoObjectKey = settings.LogoObjectKey,
            PrimaryColor = settings.PrimaryColor,
            SecondaryColor = settings.SecondaryColor,
            PublicTeacherName = settings.PublicTeacherName,
            CertificateSignatureObjectKey = settings.CertificateSignatureObjectKey,
            BrandDisplayName = branding.BrandDisplayName,
            StudentPortalWelcomeText = branding.WelcomeText,
            SupportContact = branding.SupportContact,
            SettingsJson = settings.SettingsJson
        };
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
