using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
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

    public TenantService(
        AppDbContext db,
        TenantBypassService bypass,
        ITenantContext tenantContext,
        IOptions<AuthOptions> authOptions)
    {
        _db = db;
        _bypass = bypass;
        _tenantContext = (TenantContext)tenantContext;
        _authOptions = authOptions.Value;
    }

    /// <summary>
    /// إنشاء Workspace كوحدة واحدة:
    /// Tenant + Owner Membership + TenantSettings داخل معاملة واحدة. فشل أي جزء يمنع الجزئية.
    /// OwnerUserId لا يُقرأ من الطلب — من المستخدم الحالي.
    /// </summary>
    public async Task<(ServiceResultException? Error, TenantDetailResponse? Result)> CreateTenantAsync(
        CreateTenantRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        if (!TenantSlugNormalizer.IsUrlSafe(request.Slug))
        {
            return (new ServiceResultException("InvalidSlug", "Slug must be URL-safe (letters, digits, hyphen, underscore)."), null);
        }

        var normalized = TenantSlugNormalizer.Normalize(request.Slug);
        var slugExists = await _bypass.SlugExistsAsync(normalized, excludingTenantId: null, cancellationToken);
        if (slugExists)
        {
            // تجنب تكرار Workspace من إعادة إرسال الطلب ومن سباق Slug على نفس التطبيع
            return (new ServiceResultException("SlugConflict", "A workspace with this slug already exists."), null);
        }

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

        // Bootstrap: اسمح كتابة العضوية والإعدادات بمرور Guard بسياق صريح محدود — لا يفتح عزلاً عامًا
        using var bootstrap = _tenantContext.BeginBootstrap(tenant.Id);

        var membership = new TenantMembership
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            UserId = currentUserId,
            Role = TenantMemberRole.Owner,
            Status = TenantMembershipStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.TenantMemberships.Add(membership);

        var settings = new TenantSettings
        {
            TenantId = tenant.Id,
            SettingsJson = "{}",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.TenantSettings.Add(settings);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var dto = ToDetail(tenant, TenantMemberRole.Owner, settings);
        return (null, dto);
    }

    /// <summary>قائمة Workspaces التي للمستخدم عضوية نشطة فيها — بدون فلتر المستأجر الحالي.</summary>
    public async Task<IReadOnlyList<TenantDetailResponse>> ListMineAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await _bypass.ListActiveMembershipsForUserAsync(userId, cancellationToken);
        var list = new List<TenantDetailResponse>();
        foreach (var membership in memberships)
        {
            var settings = await _bypass.FindSettingsIgnoreFiltersAsync(membership.TenantId, cancellationToken);
            list.Add(ToDetail(membership.Tenant!, membership.Role, settings));
        }
        return list;
    }

    /// <summary>قراءة التفاصيل ضمن سياق المستأجر الحالي بعد تحقق السياسة.</summary>
    public async Task<TenantDetailResponse?> GetAsync(Guid tenantId, TenantMemberRole myRole, CancellationToken cancellationToken)
    {
        var tenant = await _db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return ToDetail(tenant, myRole, settings);
    }

    /// <summary>تعديل اسم/slug المستأجر. Owner فقط. التحققات سليمة ضد تعارض NormalizedSlug.</summary>
    public async Task<(ServiceResultException? Error, TenantDetailResponse? Result)> UpdateAsync(
        Guid tenantId,
        UpdateTenantRequest request,
        TenantMemberRole myRole,
        CancellationToken cancellationToken)
    {
        if (!TenantSlugNormalizer.IsUrlSafe(request.Slug))
        {
            return (new ServiceResultException("InvalidSlug", "Slug must be URL-safe."), null);
        }

        var tenant = await _db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return (new ServiceResultException("NotFound", "Workspace not found."), null);
        }

        var normalized = TenantSlugNormalizer.Normalize(request.Slug);
        var conflict = await _bypass.SlugExistsAsync(normalized, tenantId, cancellationToken);
        if (conflict)
        {
            return (new ServiceResultException("SlugConflict", "A workspace with this slug already exists."), null);
        }

        tenant.Name = request.Name.Trim();
        tenant.Slug = request.Slug.Trim();
        tenant.NormalizedSlug = normalized;
        tenant.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return (null, ToDetail(tenant, myRole, settings));
    }

    /// <summary>قائمة الأعضاء ضمن المستأجر الحالي — تفاصيل البريد والملف فقط.</summary>
    public async Task<IReadOnlyList<TenantMemberDto>> ListMembersAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var memberships = await _db.TenantMemberships
            .Where(m => m.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var result = new List<TenantMemberDto>();
        foreach (var membership in memberships)
        {
            var user = await _db.Users.SingleOrDefaultAsync(u => u.Id == membership.UserId, cancellationToken);
            var profile = await _db.UserProfiles.SingleOrDefaultAsync(p => p.UserId == membership.UserId, cancellationToken);
            result.Add(new TenantMemberDto
            {
                UserId = membership.UserId,
                Role = membership.Role.ToString(),
                Status = membership.Status.ToString(),
                Email = user?.Email ?? string.Empty,
                FullName = profile?.FullName ?? string.Empty
            });
        }
        return result;
    }

    /// <summary>إضافة عضو موجود مسبقًا بالبريد الإلكتروني. لا يمكن منح Owner أو PlatformAdmin.</summary>
    public async Task<(ServiceResultException? Error, TenantMemberDto? Result)> AddMemberAsync(
        Guid tenantId,
        AddTenantMemberRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryParseRole(request.Role, out var role))
        {
            return (new ServiceResultException("InvalidRole", "Role must be Teacher, Assistant, or Viewer."), null);
        }

        var memberUser = await _db.Users.SingleOrDefaultAsync(u => u.Email == request.Email, cancellationToken);
        if (memberUser is null)
        {
            // لا نكشف هل البريد مسجل — المعنى الأمني أهم من الدقة هنا
            return (new ServiceResultException("UserNotFound", "The specified user is not available."), null);
        }

        // امنع منح صلاحيات للمسؤول العالمي عبر عضوية العمل
        var isPlatformAdmin = await _bypass.IsPlatformAdminAsync(memberUser.Id, cancellationToken);
        if (isPlatformAdmin)
        {
            return (new ServiceResultException("InvalidRole", "This user cannot be added as a tenant member."), null);
        }

        var exists = await _db.TenantMemberships
            .AnyAsync(m => m.TenantId == tenantId && m.UserId == memberUser.Id, cancellationToken);
        if (exists)
        {
            return (new ServiceResultException("DuplicateMember", "User is already a member of this workspace."), null);
        }

        var membership = new TenantMembership
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = memberUser.Id,
            Role = role,
            Status = TenantMembershipStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.TenantMemberships.Add(membership);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return (new ServiceResultException("DuplicateMember", "User is already a member of this workspace."), null);
        }

        var profile = await _db.UserProfiles.SingleOrDefaultAsync(p => p.UserId == memberUser.Id, cancellationToken);
        return (null, new TenantMemberDto
        {
            UserId = memberUser.Id,
            Email = memberUser.Email ?? string.Empty,
            FullName = profile?.FullName ?? string.Empty,
            Role = membership.Role.ToString(),
            Status = membership.Status.ToString()
        });
    }

    /// <summary>قراءة إعدادات المستأجر ضمن السياق الحالي.</summary>
    public async Task<TenantSettingsResponse?> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        return settings is null ? null : ToSettingsDto(settings);
    }

    /// <summary>تعديل الإعدادات — Owner فقط عبر السياسة.</summary>
    public async Task<(ServiceResultException? Error, TenantSettingsResponse? Result)> UpdateSettingsAsync(
        Guid tenantId,
        UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await _db.TenantSettings.SingleOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        if (settings is null)
        {
            return (new ServiceResultException("NotFound", "Settings not found."), null);
        }

        if (request.LogoObjectKey is not null) settings.LogoObjectKey = request.LogoObjectKey;
        if (request.PrimaryColor is not null) settings.PrimaryColor = request.PrimaryColor;
        if (request.SecondaryColor is not null) settings.SecondaryColor = request.SecondaryColor;
        if (request.PublicTeacherName is not null) settings.PublicTeacherName = request.PublicTeacherName;
        if (request.CertificateSignatureObjectKey is not null) settings.CertificateSignatureObjectKey = request.CertificateSignatureObjectKey;
        if (request.SettingsJson is not null) settings.SettingsJson = request.SettingsJson;
        settings.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return (null, ToSettingsDto(settings));
    }

    public async Task<TenantMembership?> GetMembershipAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken)
    {
        return await _bypass.FindMembershipIgnoreFiltersAsync(tenantId, userId, cancellationToken);
    }

    private static bool TryParseRole(string raw, out TenantMemberRole role)
    {
        role = TenantMemberRole.Viewer;
        if (!Enum.TryParse<TenantMemberRole>(raw, ignoreCase: true, out var parsed))
        {
            return false;
        }

        // لا يمكن منح Owner أو أي دور غير معروف من Endpoint العضو
        if (parsed is TenantMemberRole.Owner)
        {
            return false;
        }

        role = parsed;
        return true;
    }

    private static TenantDetailResponse ToDetail(Tenant tenant, TenantMemberRole role, TenantSettings? settings)
    {
        return new TenantDetailResponse
        {
            Id = tenant.Id,
            Name = tenant.Name,
            Slug = tenant.Slug,
            CountryCode = tenant.CountryCode,
            Timezone = tenant.Timezone,
            DefaultLocale = tenant.DefaultLocale,
            Status = tenant.Status.ToString(),
            MyRole = role.ToString(),
            Settings = ToSettingsDto(settings ?? new TenantSettings { TenantId = tenant.Id })
        };
    }

    private static TenantSettingsResponse ToSettingsDto(TenantSettings settings)
    {
        return new TenantSettingsResponse
        {
            LogoObjectKey = settings.LogoObjectKey,
            PrimaryColor = settings.PrimaryColor,
            SecondaryColor = settings.SecondaryColor,
            PublicTeacherName = settings.PublicTeacherName,
            CertificateSignatureObjectKey = settings.CertificateSignatureObjectKey,
            SettingsJson = settings.SettingsJson
        };
    }
}
