using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class IssuedRefreshToken
{
    public string RawToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public Guid FamilyId { get; set; }
}

public enum RefreshRotationResult
{
    /// <summary>تم التدوير بنجاح.</summary>
    Rotated = 0,

    /// <summary>الرمز غير صالح/غير موجود/منتهٍ — دون كشف تفاصيل.</summary>
    Invalid = 1,

    /// <summary>الرمز استُخدم سابقًا — قد تكون محاولة Reuse — تم إلغاء العائلة.</summary>
    ReuseDetectedFamilyRevoked = 2
}

/// <summary>
/// خدمة رموز التحديث — تخزن التجزئة فقط وتضمن التدوير الذري داخل معاملة.
/// تستخدم Global Filters بحذر: عمليات Refresh قد تحدث خارج سياق مستأجر، لذا الوصول
/// لجدول RefreshTokens يتم عبر DbContext دون فلتر مستأجر (الجدول ليس ITenantEntity).
/// </summary>
public sealed class RefreshTokenService
{
    // __Host- prefix يتطلب متصفحات تفرض Secure=true + Path=/ + بدون Domain.
    // في Development (HTTP بدون Secure) المُتصفح يرفض تخزين كوكي بهذا الاسم،
    // فيختفي الجلسة بعد F5. نستخدم اسمًا آمنًا عاديًا في Development ونُبقي
    // اسم __Host- الصارم عند تفعيل Secure في Production.
    public const string CookieNameSecure = "__Host-tp-refresh";
    public const string CookieNameDev = "tp-refresh";

    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public RefreshTokenService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<IssuedRefreshToken> IssueAsync(
        Guid userId,
        int refreshTokenDays,
        string? createdByIp,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        var familyId = Guid.NewGuid();
        var rawToken = GenerateRawToken();
        var now = _clock.UtcNow;

        var record = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = ComputeHash(rawToken),
            FamilyId = familyId,
            ExpiresAt = now.AddDays(refreshTokenDays),
            CreatedAt = now,
            CreatedByIp = createdByIp,
            UserAgent = userAgent
        };

        _db.RefreshTokens.Add(record);
        await _db.SaveChangesAsync(cancellationToken);

        return new IssuedRefreshToken
        {
            RawToken = rawToken,
            ExpiresAt = record.ExpiresAt,
            FamilyId = familyId
        };
    }

    /// <summary>
    /// تدوير ذري:
    /// - يتحقق من الرمز وعدم انتهائه وعدم إلغائه.
    /// - عند الاستبدال الناجح يُلغي القديم ويصدر الجديد من نفس Family.
    /// - عند كشف Reuse (رمز سبق استبداله) يلغي العائلة كاملة ويرفض.
    /// طريقة الحجز: PostgreSQL SELECT ... FOR UPDATE عبر ExecuteSql ثم UPDATE مشروط
    /// لمنع إصدار أكثر من رمز جديد في Refresh متزامن.
    /// </summary>
    public async Task<(RefreshRotationResult Result, Guid? UserId, IssuedRefreshToken? NewToken)> RotateAsync(
        string rawToken,
        int refreshTokenDays,
        string? createdByIp,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        var hash = ComputeHash(rawToken);
        var now = _clock.UtcNow;

        // بدء معاملة صريحة لضمان الحجز والتدوير في وحدة واحدة
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // قفل الصف المطابق إن وجد — ملاحظة: الجدول ليس مملوكًا لمستأجر لذا لا فلتر مستأجر
        var candidates = await _db.RefreshTokens
            .FromSqlInterpolated($"""
                SELECT * FROM "RefreshTokens"
                WHERE "TokenHash" = {hash}
                FOR UPDATE
                """)
            .AsTracking()
            .ToListAsync(cancellationToken);

        var existing = candidates.SingleOrDefault();
        if (existing is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return (RefreshRotationResult.Invalid, null, null);
        }

        // رمز منتهٍ أو مُلغى بسبب Logout/Password Reset — ليس Reuse
        if (existing.ExpiresAt <= now)
        {
            await transaction.RollbackAsync(cancellationToken);
            return (RefreshRotationResult.Invalid, null, null);
        }

        if (existing.RevokedAt is not null)
        {
            // رمز مستبدل سابقًا ويُستخدم مجددًا — كشف Reuse: ألغِ كل الرموز النشطة في العائلة
            if (existing.RevokedReason == RefreshTokenRevocationReasons.ReplacedByRotation)
            {
                await RevokeFamilyAsync(existing.FamilyId, RefreshTokenRevocationReasons.ReuseDetected, now, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return (RefreshRotationResult.ReuseDetectedFamilyRevoked, null, null);
            }

            await transaction.RollbackAsync(cancellationToken);
            return (RefreshRotationResult.Invalid, null, null);
        }

        // رمز نشط — تدوير داخل المعاملة
        var newRaw = GenerateRawToken();
        var newRecord = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = existing.UserId,
            TokenHash = ComputeHash(newRaw),
            FamilyId = existing.FamilyId,
            ExpiresAt = now.AddDays(refreshTokenDays),
            CreatedAt = now,
            CreatedByIp = createdByIp,
            UserAgent = userAgent
        };

        _db.RefreshTokens.Add(newRecord);

        existing.RevokedAt = now;
        existing.RevokedReason = RefreshTokenRevocationReasons.ReplacedByRotation;
        existing.ReplacedByTokenId = newRecord.Id;

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (RefreshRotationResult.Rotated, existing.UserId, new IssuedRefreshToken
        {
            RawToken = newRaw,
            ExpiresAt = newRecord.ExpiresAt,
            FamilyId = existing.FamilyId
        });
    }

    /// <summary>إلغاء رمز بعينه عند تسجيل الخروج. يتعامل بتسامح مع غياب الرمز (Logout آمن للتكرار).</summary>
    public async Task RevokeAsync(string? rawToken, string reason, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(rawToken))
        {
            return;
        }

        var hash = ComputeHash(rawToken);
        var now = _clock.UtcNow;

        // RefreshTokens ليست ITenantEntity — لا Global Filter عليها، فلا حاجة لأي تجاوز.
        var record = await _db.RefreshTokens
            .SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);

        if (record is null || record.RevokedAt is not null)
        {
            return;
        }

        record.RevokedAt = now;
        record.RevokedReason = reason;
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>إلغاء كل الرموز النشطة لمستخدم — يستخدم عند إعادة تعيين كلمة المرور.</summary>
    public async Task RevokeAllActiveForUserAsync(Guid userId, string reason, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var activeTokens = await _db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAt == null && x.ExpiresAt > now)
            .ToListAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.RevokedAt = now;
            token.RevokedReason = reason;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task RevokeFamilyAsync(Guid familyId, string reason, DateTime now, CancellationToken cancellationToken)
    {
        var activeInFamily = await _db.RefreshTokens
            .Where(x => x.FamilyId == familyId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var token in activeInFamily)
        {
            token.RevokedAt = now;
            token.RevokedReason = reason;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public static string ComputeHash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }

    private static string GenerateRawToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
}
