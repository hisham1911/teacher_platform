namespace TeacherPlatform.Application.Abstractions;

/// <summary>نتيجة خدمة تحمل كود خطأ technical يُترجم إلى 4xx في طبقة الـAPI.</summary>
public class ServiceResultException : InvalidOperationException
{
    public string ErrorCode { get; }

    public ServiceResultException(string errorCode, string message)
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
