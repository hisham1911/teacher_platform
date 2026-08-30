using System.ComponentModel.DataAnnotations;

namespace TeacherPlatform.Application.Questions;

/// <summary>
/// Server-side bulk import contract. The browser parses/ previews files, but persistence is one
/// atomic operation so a failed row can never leave half an import or orphaned questions behind.
/// </summary>
public sealed class BulkQuestionImportRequest
{
    [Required, MinLength(1), MaxLength(200)]
    public List<CreateQuestionRequest> Questions { get; set; } = [];

    /// <summary>
    /// Optional activity draft that receives every newly-created question in the same transaction.
    /// Null means import to the question bank only.
    /// </summary>
    public Guid? QuizId { get; set; }
}

public sealed class BulkQuestionImportResponse
{
    public int CreatedCount { get; set; }
    public IReadOnlyList<Guid> QuestionIds { get; set; } = [];
    public Guid? QuizId { get; set; }
}
