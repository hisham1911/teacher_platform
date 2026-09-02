using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Domain.Students;

namespace TeacherPlatform.Infrastructure.Services;

public static class StudentPortalRegistrationExtensions
{
    public static IServiceCollection AddStudentPortal(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<StudentPortalOptions>()
            .Bind(configuration.GetSection(StudentPortalOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<CommercialPolicyService>();
        services.AddScoped<CommercialPlayerJoinFilter>();
        services.Configure<MvcOptions>(options => options.Filters.AddService<CommercialPlayerJoinFilter>());

        services.AddScoped<IPasswordHasher<StudentPortalCredential>, PasswordHasher<StudentPortalCredential>>();
        services.AddScoped<StudentPortalService>();
        services.AddScoped<StudentPortalSessionCleanupService>();
        services.AddHostedService<StudentPortalSessionCleanupWorker>();

        services.AddScoped<ClassroomService>();
        services.AddScoped<AssignmentService>();
        services.AddScoped<AssignmentSessionGuardService>();
        services.AddSingleton<IStartupFilter, AssignmentSessionJoinGuardStartupFilter>();
        return services;
    }
}
