using Microsoft.AspNetCore.Identity;
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

        services.AddScoped<IPasswordHasher<StudentPortalCredential>, PasswordHasher<StudentPortalCredential>>();
        services.AddScoped<StudentPortalService>();
        return services;
    }
}
