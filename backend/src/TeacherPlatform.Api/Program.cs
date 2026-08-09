using System.Text;
using System.Text.Encodings.Web;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Api.Middleware;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Identity;
using TeacherPlatform.Infrastructure.Persistence;
using TeacherPlatform.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// ---------- Configuration validation (fail-fast عند بدء التشغيل) ----------
// كل الإعدادات تُقرأ من builder.Configuration بعد تحميل appsettings.{Environment}.json.
// في الاختبارات يضبط TestWebApplicationFactory UseEnvironment("Testing") مسبقًا،
// فيُحمَّل appsettings.Testing.json الذي يحتوي كل قيم Phase 1 بشكل صريح.
builder.Services.AddOptions<JwtOptions>()
    .Bind(configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<AuthOptions>()
    .Bind(configuration.GetSection(AuthOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(o => o.CookieSameSite is "Lax" or "Strict" or "None", "CookieSameSite must be Lax, Strict, or None.")
    .Validate(o => o.CookieSameSite != "None" || o.UseSecureCookie, "SameSite=None requires Secure cookies.")
    .Validate(o => !builder.Environment.IsProduction() || o.UseSecureCookie, "UseSecureCookie must be true in Production.")
    .ValidateOnStart();
builder.Services.AddOptions<IdentityLockoutOptions>()
    .Bind(configuration.GetSection(IdentityLockoutOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<MailOptions>()
    .Bind(configuration.GetSection(MailOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<DataProtectionSettings>()
    .Bind(configuration.GetSection(DataProtectionSettings.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<RateLimitOptions>()
    .Bind(configuration.GetSection(RateLimitOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(UrlEncoder.Default);

// Clock
builder.Services.AddSingleton<IClock, SystemClock>();

// Tenancy context (Scoped، لا Static ولا Singleton)
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

// Persistence — Interceptor Singleton ويستمد TenantId من AppDbContext نفسه وقت التنفيذ
builder.Services.AddSingleton<TenantSaveGuardInterceptor>();
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseNpgsql(
        configuration.GetConnectionString("DefaultConnection"),
        npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
    options.AddInterceptors(sp.GetRequiredService<TenantSaveGuardInterceptor>());
});

// ---------- ASP.NET Core Identity ----------
var lockoutConfig = configuration.GetSection(IdentityLockoutOptions.SectionName).Get<IdentityLockoutOptions>() ?? new IdentityLockoutOptions();
builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = true;

    // سياسة كلمة مرور معقولة غير مبالغ فيها
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 8;
    options.Password.RequiredUniqueChars = 1;

    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(lockoutConfig.DefaultLockoutMinutes);
    options.Lockout.MaxFailedAccessAttempts = lockoutConfig.MaxFailedAccessAttempts;
    options.Lockout.AllowedForNewUsers = true;

    // Security Stamp مدعوم افتراضيًا عبر Identity framework
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ---------- JWT ----------
var jwtConfig = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt configuration section is required.");
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtConfig.Issuer,
        ValidateAudience = true,
        ValidAudience = jwtConfig.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig.SigningKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(jwtConfig.ClockSkewMinutes),
        NameClaimType = "sub",
        RoleClaimType = "role"
    };
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            // لا نسجل التوكن المرفوض — فقط نتائج التحقق العامة
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtAuth");
            logger.LogDebug("JWT authentication failed: {Reason}", context.Exception.GetType().Name);
            return Task.CompletedTask;
        }
    };
});

// ---------- Authorization ----------
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.AuthenticatedUser, p => p.RequireAuthenticatedUser());
    options.AddPolicy(AuthorizationPolicies.PlatformAdmin, p => p.RequireRole(PlatformRoles.PlatformAdmin));
    options.AddPolicy(AuthorizationPolicies.ActiveTenantMember, p =>
    {
        p.RequireAuthenticatedUser();
        p.Requirements.Add(new TenantRoleRequirement(TenantRoleRequirement.AnyTenantRole));
    });
    options.AddPolicy(AuthorizationPolicies.TenantOwner, p =>
    {
        p.RequireAuthenticatedUser();
        p.Requirements.Add(new TenantRoleRequirement(TenantRoleRequirement.OwnerOnly));
    });
    options.AddPolicy(AuthorizationPolicies.TenantMemberManagement, p =>
    {
        p.RequireAuthenticatedUser();
        p.Requirements.Add(new TenantRoleRequirement(TenantRoleRequirement.OwnerOnly));
    });
    options.AddPolicy(AuthorizationPolicies.TenantSettingsManagement, p =>
    {
        p.RequireAuthenticatedUser();
        p.Requirements.Add(new TenantRoleRequirement(TenantRoleRequirement.OwnerOnly));
    });
    options.AddPolicy(AuthorizationPolicies.TenantContentManagement, p =>
    {
        p.RequireAuthenticatedUser();
        p.Requirements.Add(new TenantRoleRequirement(TenantRoleRequirement.OwnerOrTeacher));
    });
});
builder.Services.AddScoped<IAuthorizationHandler, TenantRoleHandler>();

// ---------- Data Protection ----------
// تُقرأ الإعدادات هنا من builder.Configuration بعد تحميل appsettings.البيئة.
// في الاختبارات يضبط TestWebApplicationFactory البيئة Testing ويضيف appsettings.Testing.json
// التي تحتوي KeysDirectory مؤقتًا من Factory.
var dpSettings = configuration.GetSection(DataProtectionSettings.SectionName).Get<DataProtectionSettings>() ?? new DataProtectionSettings();
var keysDirectory = dpSettings.KeysDirectory;
if (string.IsNullOrEmpty(keysDirectory))
{
    keysDirectory = Path.Combine(Path.GetTempPath(), "teacher-platform-dataprotection");
}
if (!Path.IsPathRooted(keysDirectory))
{
    keysDirectory = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, keysDirectory));
}
if (builder.Environment.IsProduction() && keysDirectory.StartsWith(AppContext.BaseDirectory, StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("DataProtection keys must not be stored under the release directory in Production.");
}
Directory.CreateDirectory(keysDirectory);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keysDirectory))
    .SetApplicationName(dpSettings.ApplicationName);

// ---------- CORS ----------
builder.Services.AddCors(options =>
{
    options.AddPolicy("ApiCors", policy =>
    {
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (allowedOrigins.Any(o => o.Contains('*', StringComparison.Ordinal)))
        {
            throw new InvalidOperationException("Wildcard CORS origins are not allowed; specify explicit origins.");
        }

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ---------- Rate Limiting ----------
var rateConfig = configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>() ?? new RateLimitOptions();
static FixedWindowRateLimiterOptions CreateFixedWindowOptions(RateLimitOptions config) => new()
{
    PermitLimit = config.PermitLimit,
    Window = TimeSpan.FromSeconds(config.WindowSeconds),
    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
    QueueLimit = 0
};

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(RateLimitPolicies.AuthEndpoints, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => CreateFixedWindowOptions(rateConfig)));
    options.AddPolicy(RateLimitPolicies.PlayerEndpoints, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => CreateFixedWindowOptions(rateConfig)));
    options.AddPolicy(RateLimitPolicies.ReportExports, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => CreateFixedWindowOptions(rateConfig)));
});

// ---------- Application services ----------
builder.Services.AddScoped<IEmailSender, FileEmailSender>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<TenantService>();
builder.Services.AddScoped<TenantBypassService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddSingleton<JwtTokenGenerator>();

// ---------- Phase 2: Object Storage + Questions ----------
builder.Services.AddOptions<TeacherPlatform.Application.Options.StorageOptions>()
    .Bind(configuration.GetSection(TeacherPlatform.Application.Options.StorageOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(o => o.Provider is "Local" or "S3", "Storage Provider must be Local or S3.")
    .Validate(o => o.Provider != "S3"
        || (!string.IsNullOrWhiteSpace(o.Endpoint) && !string.IsNullOrWhiteSpace(o.Bucket)
            && !string.IsNullOrWhiteSpace(o.AccessKey) && !string.IsNullOrWhiteSpace(o.SecretKey)),
        "S3 storage requires Endpoint/Bucket/AccessKey/SecretKey.")
    .ValidateOnStart();

var storageOptions = configuration.GetSection(TeacherPlatform.Application.Options.StorageOptions.SectionName)
    .Get<TeacherPlatform.Application.Options.StorageOptions>() ?? new TeacherPlatform.Application.Options.StorageOptions();
if (string.Equals(storageOptions.Provider, "S3", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<TeacherPlatform.Application.Abstractions.IObjectStorage>(
        _ => new TeacherPlatform.Infrastructure.Services.S3ObjectStorage(storageOptions));
}
else
{
    var storageRoot = storageOptions.LocalRootPath;
    builder.Services.AddSingleton<TeacherPlatform.Application.Abstractions.IObjectStorage>(sp =>
    {
        var env = sp.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        return new TeacherPlatform.Infrastructure.Services.LocalObjectStorage(env, storageRoot);
    });
}
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.MediaService>();
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.QuestionService>();

// ---------- Phase 3: Quiz Builder & Publishing ----------
builder.Services.AddOptions<TeacherPlatform.Application.Options.QuizLimitOptions>()
    .Bind(configuration.GetSection(TeacherPlatform.Application.Options.QuizLimitOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddScoped<TeacherPlatform.Application.Abstractions.IQuizLimitService,
    TeacherPlatform.Infrastructure.Services.QuizLimitService>();
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.QuizService>();

// ---------- Phase 4: Sessions & Player ----------
builder.Services.AddOptions<TeacherPlatform.Application.Options.SessionOptions>()
    .Bind(configuration.GetSection(TeacherPlatform.Application.Options.SessionOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.GuestTokenService>();
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.SessionService>();
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.PlayerService>();

// ---------- Phase 5: Reports ----------
builder.Services.AddScoped<TeacherPlatform.Infrastructure.Services.ReportService>();

// ---------- Health Checks ----------
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

// ---------- Forwarded Headers ----------
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
});

var app = builder.Build();

// Seed الأدوار العالمية في بدء التشغيل — لا ننشئ مستخدم PlatformAdmin
using (var scope = app.Services.CreateScope())
{
    if (configuration.GetValue<bool>("SeedRoles"))
    {
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        if (!await roleManager.RoleExistsAsync(PlatformRoles.PlatformAdmin))
        {
            await roleManager.CreateAsync(new ApplicationRole { Name = PlatformRoles.PlatformAdmin });
        }
    }
}

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler();
app.UseCors("ApiCors");
app.UseMiddleware<CorrelationIdMiddleware>();

app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false
});
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Name == "database"
});

app.UseRateLimiter();
app.UseMiddleware<OriginCheckMiddleware>();

app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapControllers();

app.Run();
