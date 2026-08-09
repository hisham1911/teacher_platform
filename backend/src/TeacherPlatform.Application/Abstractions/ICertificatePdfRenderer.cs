using TeacherPlatform.Application.Certificates;

namespace TeacherPlatform.Application.Abstractions;

public interface ICertificatePdfRenderer
{
    byte[] Render(CertificatePdfModel certificate);
}
