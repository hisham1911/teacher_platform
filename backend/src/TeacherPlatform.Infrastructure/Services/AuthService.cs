using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Auth;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class AuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IEmailSender _emailSender;
    private readonly AuthOptions _authOptions;
    private readonly AppDbContext _db;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IEmailSender emailSender,
        IOptions<AuthOptions> authOptions,
        AppDbContext db)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailSender = emailSender;
        _authOptions = authOptions.Value;
        _db = db;
    }

    /// <summary>تسجيل مستخدم جديد مع ملفه الشخصي. لا يقبل أي Role من العميل.</summary>
    public async Task<(ServiceResultException? Error, ApplicationUser? User)> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
        {
            // لا نكشف سبب الفشل الحقيقي عند إعادة المحاولة — لكن البريد موجود فعليًا
            return (new ServiceResultException("RegistrationFailed", "Unable to complete registration."), null);
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = false
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return (new ServiceResultException("RegistrationFailed", "Unable to complete registration."), null);
        }

        var profile = new UserProfile
        {
            UserId = user.Id,
            FullName = request.FullName,
            Locale = "ar",
            Status = UserProfileStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.UserProfiles.Add(profile);
        await _db.SaveChangesAsync(cancellationToken);

        var confirmToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var confirmUrl = BuildActionUrl("/auth/confirm-email", user.Id, confirmToken);
        await _emailSender.SendAsync(user.Email!, EmailKind.Confirmation, confirmUrl, cancellationToken);

        return (null, user);
    }

    /// <summary>تأكيد البريد الإلكتروني عبر Token آمن URL-safe.</summary>
    public async Task<ServiceResultException?> ConfirmEmailAsync(string uid, string token)
    {
        if (!Guid.TryParse(uid, out var userId))
        {
            return new ServiceResultException("InvalidToken", "Invalid confirmation link.");
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return new ServiceResultException("InvalidToken", "Invalid confirmation link.");
        }

        var decoded = DecodeToken(token);
        if (decoded is null)
        {
            return new ServiceResultException("InvalidToken", "Invalid confirmation link.");
        }

        var result = await _userManager.ConfirmEmailAsync(user, decoded);
        return result.Succeeded ? null : new ServiceResultException("InvalidToken", "Invalid confirmation link.");
    }

    /// <summary>تسجيل الدخول — يرفض الدخول دون تأكيد البريد ويطبق Lockout.</summary>
    public async Task<(ServiceResultException? Error, ApplicationUser? User)> LoginAsync(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return (new ServiceResultException("Unauthorized", "Invalid credentials."), null);
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return (new ServiceResultException("LockedOut", "Account is temporarily locked."), null);
        }

        if (!result.Succeeded)
        {
            // SignInManager.CheckPasswordSignInAsync مع RequireConfirmedEmail=true يعيد NotAllowed عند
            // عدم تأكيد البريد؛ نميّز بين "كلمة مرور خاطئة" (401) و"بريد غير مؤكد" (403).
            if (result.IsNotAllowed && !user.EmailConfirmed)
            {
                return (new ServiceResultException("EmailNotConfirmed", "Email confirmation is required before sign in."), null);
            }

            return (new ServiceResultException("Unauthorized", "Invalid credentials."), null);
        }

        // فحص صريح إضافي: حتى لو تغيّرت سياسة RequireConfirmedEmail لاحقًا يبقى المنطق واضحًا
        if (!user.EmailConfirmed)
        {
            return (new ServiceResultException("EmailNotConfirmed", "Email confirmation is required before sign in."), null);
        }

        return (null, user);
    }

    /// <summary>طلب إعادة تعيين كلمة المرور — يرجع دائمًا نجاحًا عامًا حتى لو لم يوجد البريد.</summary>
    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return;
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var url = BuildActionUrl("/auth/reset-password", user.Id, token);
        await _emailSender.SendAsync(user.Email!, EmailKind.PasswordReset, url, cancellationToken);
    }

    /// <summary>إعادة تعيين كلمة المرور — تحدّث Security Stamp وإلغاء رموز التحديث القديمة.</summary>
    public async Task<(ServiceResultException? Error, Guid? UserId)> ResetPasswordAsync(ResetPasswordRequest request)
    {
        if (!Guid.TryParse(request.Uid, out var userId))
        {
            return (new ServiceResultException("InvalidToken", "Invalid reset link."), null);
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return (new ServiceResultException("InvalidToken", "Invalid reset link."), null);
        }

        var decoded = DecodeToken(request.Token);
        if (decoded is null)
        {
            return (new ServiceResultException("InvalidToken", "Invalid reset link."), null);
        }

        var result = await _userManager.ResetPasswordAsync(user, decoded, request.NewPassword);
        if (!result.Succeeded)
        {
            return (new ServiceResultException("InvalidToken", "Invalid reset link."), null);
        }

        // Security Stamp تتغير تلقائيًا عبر ResetPasswordAsync في UserManager
        return (null, user.Id);
    }

    private string BuildActionUrl(string path, Guid userId, string rawToken)
    {
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));
        var baseUrl = _authOptions.WebBaseUrl.TrimEnd('/');
        // UrlEncode handles special chars properly for browsers reading query strings
        return $"{baseUrl}{path}?uid={userId}&token={Uri.EscapeDataString(encodedToken)}";
    }

    private static string? DecodeToken(string encoded)
    {
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encoded));
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
