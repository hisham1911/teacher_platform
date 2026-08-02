namespace TeacherPlatform.Application.Abstractions;

/// <summary>
/// تجريد تخزين كائنات. التنفيذات: Local (تطوير/اختبارات) وS3-compatible (إنتاج).
/// لا يُعاد مطلقًا للواجهة أي مسار داخلي — الـAPI يبني روابط قراءة مؤقتة عند الحاجة.
/// </summary>
public interface IObjectStorage
{
    /// <summary>يحفظ المحتوى تحت objectKey المحدد. يُفترض أن الـمفتاح قد أُنشئ بـGUID آمن.</summary>
    Task UploadAsync(string objectKey, Stream content, string contentType, CancellationToken cancellationToken = default);

    /// <summary>يفتح بث قراءة للكائن. يُرمى FileNotFoundException عند غيابه.</summary>
    Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default);

    /// <summary>يحذف الكائن إن وُجد (Idempotent).</summary>
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(string objectKey, CancellationToken cancellationToken = default);
}
