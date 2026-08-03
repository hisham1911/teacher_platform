using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Application.Quizzes;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Questions.Validation;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Use cases بناء الاختبارات ونشرها. كل القراءات تمر بـGlobal Filters (TenantId == CurrentTenantId)
/// وكل الكتابات تمر بحارس TenantSaveGuardInterceptor.
///
/// نموذج الإصدارات:
/// - لكل Quiz مسودة واحدة حيّة (CurrentDraftVersionId) قابلة للتعديل.
/// - النشر يجمّد المسودة (Status=Published + Checksum) وينشئ مسودة جديدة منسوخة منها.
/// - النسخ المنشورة Immutable — لا تُعدَّل ولا تُحذف، وتبقى قابلة للمعاينة.
/// - كل عنصر يثبّت QuestionVersionId وقت الإضافة؛ تعديل السؤال المصدر لا يغيّر الاختبار.
/// </summary>
public sealed class QuizService
{
    private readonly AppDbContext _db;
    private readonly IQuizLimitService _limits;

    public QuizService(AppDbContext db, IQuizLimitService limits)
    {
        _db = db;
        _limits = limits;
    }

    // ---------- Listing & Detail ----------

    public async Task<PagedResponse<QuizListItemResponse>> ListQuizzesAsync(
        QuizListQuery query,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);

        var baseQuery = _db.Quizzes.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Status)
            && Enum.TryParse<QuizStatus>(query.Status, ignoreCase: true, out var parsedStatus))
        {
            baseQuery = baseQuery.Where(q => q.Status == parsedStatus);
        }
        else
        {
            // افتراضيًا لا نظهر المؤرشفة إلا بطلب صريح
            baseQuery = baseQuery.Where(q => q.Status != QuizStatus.Archived);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = query.Search.Trim();
            baseQuery = baseQuery.Where(q => EF.Functions.ILike(q.Title, $"%{pattern}%"));
        }

        var total = await baseQuery.CountAsync(cancellationToken);

        var items = await baseQuery
            .OrderByDescending(q => q.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(q => new QuizListItemResponse
            {
                Id = q.Id,
                Title = q.Title,
                Slug = q.Slug,
                Status = q.Status.ToString(),
                CurrentPublishedVersionNumber = q.Versions
                    .Where(v => q.CurrentPublishedVersionId == v.Id)
                    .Select(v => (int?)v.VersionNumber)
                    .FirstOrDefault(),
                ItemCount = q.Versions
                    .Where(v => q.CurrentDraftVersionId == v.Id)
                    .Select(v => v.Items.Count)
                    .FirstOrDefault(),
                CreatedAt = q.CreatedAt,
                UpdatedAt = q.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResponse<QuizListItemResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        };
    }

    public async Task<QuizDetailResponse?> GetQuizAsync(Guid quizId, CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);

        if (quiz is null)
        {
            return null;
        }

        var publishedNumber = quiz.CurrentPublishedVersionId is Guid pubId
            ? await _db.QuizVersions.AsNoTracking()
                .Where(v => v.Id == pubId)
                .Select(v => (int?)v.VersionNumber)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return new QuizDetailResponse
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Slug = quiz.Slug,
            Description = quiz.Description,
            Status = quiz.Status.ToString(),
            CurrentDraftVersionId = quiz.CurrentDraftVersionId,
            CurrentPublishedVersionId = quiz.CurrentPublishedVersionId,
            CurrentPublishedVersionNumber = publishedNumber,
            PublicCode = quiz.PublicCode,
            SubjectId = quiz.SubjectId,
            GradeId = quiz.GradeId,
            CreatedAt = quiz.CreatedAt,
            UpdatedAt = quiz.UpdatedAt,
            Version = quiz.Version
        };
    }

    // ---------- Create / Update / Archive ----------

    /// <summary>إنشاء اختبار مع مسودة Version رقم 1 في معاملة واحدة.</summary>
    public async Task<(ServiceResultException? Error, QuizDetailResponse? Result)> CreateQuizAsync(
        CreateQuizRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

        var slugTaken = await _db.Quizzes
            .AnyAsync(q => q.NormalizedSlug == normalizedSlug, cancellationToken);
        if (slugTaken)
        {
            return (new ServiceResultException("SlugConflict", "A quiz with this slug already exists."), null);
        }

        var limitError = await _limits.CheckCanCreateQuizAsync(Guid.Empty, cancellationToken);
        if (limitError is not null)
        {
            return (limitError, null);
        }

        var now = DateTime.UtcNow;
        var quizId = Guid.NewGuid();
        var draftId = Guid.NewGuid();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var quiz = new Quiz
        {
            Id = quizId,
            Title = request.Title.Trim(),
            Slug = request.Slug.Trim(),
            NormalizedSlug = normalizedSlug,
            Description = request.Description?.Trim(),
            Status = QuizStatus.Draft,
            CurrentDraftVersionId = draftId,
            CurrentPublishedVersionId = null,
            PublicCode = GeneratePublicCode(),
            SubjectId = request.SubjectId,
            GradeId = request.GradeId,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Quizzes.Add(quiz);

        var draft = new QuizVersion
        {
            Id = draftId,
            QuizId = quizId,
            VersionNumber = 1,
            Status = QuizVersionStatus.Draft,
            TitleSnapshot = quiz.Title,
            DescriptionSnapshot = quiz.Description,
            InstructionsSnapshot = null,
            PassingPercentage = 50,
            TimeMode = QuizTimeMode.None,
            TimeLimitSeconds = null,
            ShuffleQuestions = false,
            ShuffleOptions = false,
            ThemeJson = SerializeTheme(new QuizThemeInput()),
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.QuizVersions.Add(draft);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (null, new QuizDetailResponse
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Slug = quiz.Slug,
            Description = quiz.Description,
            Status = quiz.Status.ToString(),
            CurrentDraftVersionId = quiz.CurrentDraftVersionId,
            CurrentPublishedVersionId = null,
            CurrentPublishedVersionNumber = null,
            PublicCode = quiz.PublicCode,
            SubjectId = quiz.SubjectId,
            GradeId = quiz.GradeId,
            CreatedAt = quiz.CreatedAt,
            UpdatedAt = quiz.UpdatedAt,
            Version = quiz.Version
        });
    }

    public async Task<(ServiceResultException? Error, QuizDetailResponse? Result)> UpdateQuizAsync(
        Guid quizId,
        UpdateQuizRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        if (request.BaseVersion != quiz.Version)
        {
            return (new ServiceResultException("Conflict", "The quiz was modified by someone else. Reload and try again."), null);
        }

        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();
        var slugTaken = await _db.Quizzes
            .AnyAsync(q => q.Id != quizId && q.NormalizedSlug == normalizedSlug, cancellationToken);
        if (slugTaken)
        {
            return (new ServiceResultException("SlugConflict", "A quiz with this slug already exists."), null);
        }

        quiz.Title = request.Title.Trim();
        quiz.Slug = request.Slug.Trim();
        quiz.NormalizedSlug = normalizedSlug;
        quiz.Description = request.Description?.Trim();
        quiz.SubjectId = request.SubjectId;
        quiz.GradeId = request.GradeId;
        quiz.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The quiz was modified by someone else. Reload and try again."), null);
        }

        return (null, new QuizDetailResponse
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Slug = quiz.Slug,
            Description = quiz.Description,
            Status = quiz.Status.ToString(),
            CurrentDraftVersionId = quiz.CurrentDraftVersionId,
            CurrentPublishedVersionId = quiz.CurrentPublishedVersionId,
            PublicCode = quiz.PublicCode,
            SubjectId = quiz.SubjectId,
            GradeId = quiz.GradeId,
            CreatedAt = quiz.CreatedAt,
            UpdatedAt = quiz.UpdatedAt,
            Version = quiz.Version
        });
    }

    /// <summary>أرشفة الاختبار — تحدّث Status فقط ولا تمس النسخ ولا العناصر.</summary>
    public async Task<ServiceResultException?> ArchiveQuizAsync(Guid quizId, CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null)
        {
            return new ServiceResultException("NotFound", "Quiz not found.");
        }

        if (quiz.Status == QuizStatus.Archived)
        {
            return null; // Idempotent
        }

        quiz.Status = QuizStatus.Archived;
        quiz.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return null;
    }

    // ---------- Draft editing ----------

    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> GetDraftAsync(
        Guid quizId,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draft = await LoadDraftWithItemsAsync(quiz.CurrentDraftVersionId.Value, cancellationToken);
        if (draft is null)
        {
            return (new ServiceResultException("NotFound", "Draft version not found."), null);
        }

        return (null, draft);
    }

    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> UpdateDraftAsync(
        Guid quizId,
        UpdateDraftRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draft = await _db.QuizVersions
            .SingleOrDefaultAsync(v => v.Id == quiz.CurrentDraftVersionId.Value, cancellationToken);
        if (draft is null)
        {
            return (new ServiceResultException("NotFound", "Draft version not found."), null);
        }

        if (request.BaseVersion != draft.Version)
        {
            return (new ServiceResultException("Conflict", "The draft was modified by someone else. Reload and try again."), null);
        }

        if (!Enum.TryParse<QuizTimeMode>(request.TimeMode, ignoreCase: true, out var timeMode))
        {
            return (new ServiceResultException("InvalidTimeMode", "TimeMode must be None, TotalTime, or PerQuestion."), null);
        }

        if (timeMode != QuizTimeMode.None && request.TimeLimitSeconds is null)
        {
            return (new ServiceResultException("TimeLimitRequired", "TimeLimitSeconds is required when a time mode is set."), null);
        }

        draft.TitleSnapshot = request.Title.Trim();
        draft.DescriptionSnapshot = request.Description?.Trim();
        draft.InstructionsSnapshot = request.Instructions?.Trim();
        draft.PassingPercentage = request.PassingPercentage;
        draft.TimeMode = timeMode;
        draft.TimeLimitSeconds = timeMode == QuizTimeMode.None ? null : request.TimeLimitSeconds;
        draft.ShuffleQuestions = request.ShuffleQuestions;
        draft.ShuffleOptions = request.ShuffleOptions;
        draft.ThemeJson = SerializeTheme(request.Theme);
        draft.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The draft was modified by someone else. Reload and try again."), null);
        }

        var result = await LoadDraftWithItemsAsync(draft.Id, cancellationToken);
        return (null, result);
    }

    // ---------- Items ----------

    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> AddItemAsync(
        Guid quizId,
        AddQuizItemRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draftId = quiz.CurrentDraftVersionId.Value;

        // السؤال يجب أن يكون موجودًا ونشطًا وضمن نفس المستأجر (Global Filters تفرض العزل).
        var question = await _db.Questions
            .AsNoTracking()
            .SingleOrDefaultAsync(q => q.Id == request.QuestionId, cancellationToken);

        if (question is null || question.Status == QuestionStatus.Archived || question.CurrentVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Question not found or is archived."), null);
        }

        var duplicate = await _db.QuizVersionItems
            .AnyAsync(i => i.QuizVersionId == draftId && i.QuestionVersion!.QuestionId == request.QuestionId, cancellationToken);
        if (duplicate)
        {
            return (new ServiceResultException("DuplicateMember", "This question is already in the quiz."), null);
        }

        var limitError = await _limits.CheckCanAddQuestionAsync(Guid.Empty, draftId, cancellationToken);
        if (limitError is not null)
        {
            return (limitError, null);
        }

        var maxSort = await _db.QuizVersionItems
            .Where(i => i.QuizVersionId == draftId)
            .MaxAsync(i => (int?)i.SortOrder, cancellationToken) ?? -1;

        var now = DateTime.UtcNow;
        var item = new QuizVersionItem
        {
            Id = Guid.NewGuid(),
            QuizVersionId = draftId,
            QuestionVersionId = question.CurrentVersionId.Value, // تثبيت النسخة الحالية وقت الإضافة
            SortOrder = maxSort + 1,
            Points = request.Points,
            IsRequired = request.IsRequired,
            CreatedAt = now
        };
        _db.QuizVersionItems.Add(item);

        await _db.SaveChangesAsync(cancellationToken);

        var result = await LoadDraftWithItemsAsync(draftId, cancellationToken);
        return (null, result);
    }

    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> UpdateItemAsync(
        Guid quizId,
        Guid itemId,
        UpdateQuizItemRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var item = await _db.QuizVersionItems
            .SingleOrDefaultAsync(i => i.Id == itemId && i.QuizVersionId == quiz.CurrentDraftVersionId.Value, cancellationToken);
        if (item is null)
        {
            return (new ServiceResultException("NotFound", "Quiz item not found."), null);
        }

        item.Points = request.Points;
        item.IsRequired = request.IsRequired;

        await _db.SaveChangesAsync(cancellationToken);

        var result = await LoadDraftWithItemsAsync(quiz.CurrentDraftVersionId.Value, cancellationToken);
        return (null, result);
    }

    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> RemoveItemAsync(
        Guid quizId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draftId = quiz.CurrentDraftVersionId.Value;
        var item = await _db.QuizVersionItems
            .SingleOrDefaultAsync(i => i.Id == itemId && i.QuizVersionId == draftId, cancellationToken);
        if (item is null)
        {
            return (new ServiceResultException("NotFound", "Quiz item not found."), null);
        }

        _db.QuizVersionItems.Remove(item);
        await _db.SaveChangesAsync(cancellationToken);

        // إعادة ترقيم SortOrder لسد الفجوة
        var remaining = await _db.QuizVersionItems
            .Where(i => i.QuizVersionId == draftId)
            .OrderBy(i => i.SortOrder)
            .ToListAsync(cancellationToken);

        for (var i = 0; i < remaining.Count; i++)
        {
            if (remaining[i].SortOrder != i)
            {
                remaining[i].SortOrder = i;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        var result = await LoadDraftWithItemsAsync(draftId, cancellationToken);
        return (null, result);
    }

    /// <summary>
    /// إعادة ترتيب العناصر. يجب أن تطابق OrderedItemIds كل عناصر المسودة تمامًا.
    /// نستخدم قيمًا سالبة مؤقتة لتفادي تعارض الفهرس الفريد (QuizVersionId, SortOrder) أثناء التحديث.
    /// </summary>
    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> ReorderItemsAsync(
        Guid quizId,
        ReorderItemsRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draftId = quiz.CurrentDraftVersionId.Value;
        var items = await _db.QuizVersionItems
            .Where(i => i.QuizVersionId == draftId)
            .ToListAsync(cancellationToken);

        var existingIds = items.Select(i => i.Id).ToHashSet();
        var incomingIds = request.OrderedItemIds.ToHashSet();

        if (existingIds.Count != incomingIds.Count || !existingIds.SetEquals(incomingIds))
        {
            return (new ServiceResultException("ReorderMismatch", "OrderedItemIds must match exactly the current draft items."), null);
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // مرحلة 1: قيم سالبة مؤقتة فريدة لتفادي تعارض الفهرس الفريد
        for (var i = 0; i < request.OrderedItemIds.Count; i++)
        {
            var item = items.Single(x => x.Id == request.OrderedItemIds[i]);
            item.SortOrder = -(i + 1);
        }
        await _db.SaveChangesAsync(cancellationToken);

        // مرحلة 2: القيم النهائية
        for (var i = 0; i < request.OrderedItemIds.Count; i++)
        {
            var item = items.Single(x => x.Id == request.OrderedItemIds[i]);
            item.SortOrder = i;
        }
        await _db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var result = await LoadDraftWithItemsAsync(draftId, cancellationToken);
        return (null, result);
    }

    // ---------- Preview & Versions ----------

    /// <summary>معاينة المعلّم — نفس محتوى المسودة الكامل مع معلومات التصحيح. لا ينشئ أي محاولة.</summary>
    public async Task<(ServiceResultException? Error, QuizDraftResponse? Result)> GetPreviewAsync(
        Guid quizId,
        CancellationToken cancellationToken)
    {
        return await GetDraftAsync(quizId, cancellationToken);
    }

    public async Task<IReadOnlyList<QuizVersionSummaryResponse>> ListVersionsAsync(
        Guid quizId,
        CancellationToken cancellationToken)
    {
        var exists = await _db.Quizzes.AsNoTracking().AnyAsync(q => q.Id == quizId, cancellationToken);
        if (!exists)
        {
            return [];
        }

        var versions = await _db.QuizVersions
            .AsNoTracking()
            .Where(v => v.QuizId == quizId)
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new QuizVersionSummaryResponse
            {
                Id = v.Id,
                VersionNumber = v.VersionNumber,
                Status = v.Status.ToString(),
                ItemCount = v.Items.Count,
                TotalPoints = v.Items.Sum(i => i.Points),
                PublishedAt = v.PublishedAt,
                Checksum = v.Checksum,
                CreatedAt = v.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return versions;
    }

    public async Task<(ServiceResultException? Error, QuizPublishedVersionResponse? Result)> GetVersionAsync(
        Guid quizId,
        int versionNumber,
        CancellationToken cancellationToken)
    {
        var exists = await _db.Quizzes.AsNoTracking().AnyAsync(q => q.Id == quizId, cancellationToken);
        if (!exists)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var version = await _db.QuizVersions
            .AsNoTracking()
            .Include(v => v.Items)
            .SingleOrDefaultAsync(v => v.QuizId == quizId && v.VersionNumber == versionNumber, cancellationToken);

        if (version is null)
        {
            return (new ServiceResultException("NotFound", "Quiz version not found."), null);
        }

        var items = await BuildItemResponsesAsync(version.Items.ToList(), cancellationToken);

        return (null, new QuizPublishedVersionResponse
        {
            Id = version.Id,
            QuizId = version.QuizId,
            VersionNumber = version.VersionNumber,
            Title = version.TitleSnapshot,
            Description = version.DescriptionSnapshot,
            Instructions = version.InstructionsSnapshot,
            PassingPercentage = version.PassingPercentage,
            TimeMode = version.TimeMode.ToString(),
            TimeLimitSeconds = version.TimeLimitSeconds,
            ShuffleQuestions = version.ShuffleQuestions,
            ShuffleOptions = version.ShuffleOptions,
            Theme = DeserializeTheme(version.ThemeJson),
            Items = items,
            TotalPoints = items.Sum(i => i.Points),
            PublishedAt = version.PublishedAt,
            Checksum = version.Checksum
        });
    }

    // ---------- Publish ----------

    /// <summary>
    /// نشر المسودة الحالية. معاملة واحدة All-or-Nothing:
    /// تحقق → تحقق من الحصة → تحقق من صحة كل سؤال → checksum → تجميد المسودة →
    /// تقاعد النسخة المنشورة السابقة → إنشاء مسودة جديدة منسوخة → تحديث الاختبار.
    /// Idempotent: إعادة نشر نفس المسودة المنشورة مسبقًا تعيد النتيجة دون نسخ مكررة.
    /// </summary>
    public async Task<(ServiceResultException? Error, PublishQuizResponse? Result)> PublishAsync(
        Guid quizId,
        PublishQuizRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes
            .SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);

        if (quiz is null || quiz.CurrentDraftVersionId is null)
        {
            return (new ServiceResultException("NotFound", "Quiz not found."), null);
        }

        var draft = await _db.QuizVersions
            .Include(v => v.Items)
            .SingleOrDefaultAsync(v => v.Id == quiz.CurrentDraftVersionId.Value, cancellationToken);

        if (draft is null)
        {
            return (new ServiceResultException("NotFound", "Draft version not found."), null);
        }

        // Idempotency: إن كانت هذه المسودة هي المنشورة حاليًا فأعد النتيجة الموجودة.
        if (quiz.CurrentPublishedVersionId == draft.Id && draft.Status == QuizVersionStatus.Published)
        {
            return (null, new PublishQuizResponse
            {
                QuizId = quiz.Id,
                PublishedVersionId = draft.Id,
                VersionNumber = draft.VersionNumber,
                PublishedAt = draft.PublishedAt ?? DateTime.UtcNow,
                Checksum = draft.Checksum ?? string.Empty,
                PublicCode = quiz.PublicCode,
                ShareUrl = BuildShareUrl(quiz.PublicCode)
            });
        }

        if (request.BaseVersion != draft.Version)
        {
            return (new ServiceResultException("Conflict", "The draft was modified by someone else. Reload and try again."), null);
        }

        var limitError = await _limits.CheckCanPublishAsync(Guid.Empty, quizId, cancellationToken);
        if (limitError is not null)
        {
            return (limitError, null);
        }

        // التحقق من الصحة قبل النشر
        var validationError = await ValidateDraftForPublishAsync(draft, cancellationToken);
        if (validationError is not null)
        {
            return (validationError, null);
        }

        var now = DateTime.UtcNow;
        var checksum = ComputeChecksum(draft);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // 1) تقاعد النسخة المنشورة السابقة
        if (quiz.CurrentPublishedVersionId is Guid previousPublishedId)
        {
            var previous = await _db.QuizVersions
                .SingleOrDefaultAsync(v => v.Id == previousPublishedId, cancellationToken);
            if (previous is not null && previous.Status == QuizVersionStatus.Published)
            {
                previous.Status = QuizVersionStatus.Retired;
                previous.UpdatedAt = now;
            }
        }

        // 2) تجميد المسودة الحالية كنسخة منشورة
        draft.Status = QuizVersionStatus.Published;
        draft.PublishedAt = now;
        draft.Checksum = checksum;
        draft.UpdatedAt = now;

        // 3) إنشاء مسودة جديدة منسوخة من المنشورة
        var maxVersionNumber = await _db.QuizVersions
            .Where(v => v.QuizId == quizId)
            .MaxAsync(v => (int?)v.VersionNumber, cancellationToken) ?? 0;

        var newDraft = new QuizVersion
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            VersionNumber = maxVersionNumber + 1,
            Status = QuizVersionStatus.Draft,
            TitleSnapshot = draft.TitleSnapshot,
            DescriptionSnapshot = draft.DescriptionSnapshot,
            InstructionsSnapshot = draft.InstructionsSnapshot,
            PassingPercentage = draft.PassingPercentage,
            TimeMode = draft.TimeMode,
            TimeLimitSeconds = draft.TimeLimitSeconds,
            ShuffleQuestions = draft.ShuffleQuestions,
            ShuffleOptions = draft.ShuffleOptions,
            ThemeJson = draft.ThemeJson,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.QuizVersions.Add(newDraft);

        foreach (var item in draft.Items.OrderBy(i => i.SortOrder))
        {
            _db.QuizVersionItems.Add(new QuizVersionItem
            {
                Id = Guid.NewGuid(),
                QuizVersionId = newDraft.Id,
                QuestionVersionId = item.QuestionVersionId,
                SortOrder = item.SortOrder,
                Points = item.Points,
                IsRequired = item.IsRequired,
                CreatedAt = now
            });
        }

        // 4) تحديث الاختبار
        quiz.CurrentPublishedVersionId = draft.Id;
        quiz.CurrentDraftVersionId = newDraft.Id;
        quiz.Status = QuizStatus.Published;
        quiz.UpdatedAt = now;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The quiz was modified by someone else. Reload and try again."), null);
        }

        return (null, new PublishQuizResponse
        {
            QuizId = quiz.Id,
            PublishedVersionId = draft.Id,
            VersionNumber = draft.VersionNumber,
            PublishedAt = now,
            Checksum = checksum,
            PublicCode = quiz.PublicCode,
            ShareUrl = BuildShareUrl(quiz.PublicCode)
        });
    }

    // ---------- Share & Public ----------

    public async Task<QuizShareResponse?> GetShareAsync(Guid quizId, CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes.AsNoTracking().SingleOrDefaultAsync(q => q.Id == quizId, cancellationToken);
        if (quiz is null)
        {
            return null;
        }

        var publishedNumber = quiz.CurrentPublishedVersionId is Guid pubId
            ? await _db.QuizVersions.AsNoTracking()
                .Where(v => v.Id == pubId)
                .Select(v => (int?)v.VersionNumber)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return new QuizShareResponse
        {
            QuizId = quiz.Id,
            PublicCode = quiz.PublicCode,
            ShareUrl = BuildShareUrl(quiz.PublicCode),
            Status = quiz.Status.ToString(),
            PublishedVersionNumber = publishedNumber
        };
    }

    /// <summary>
    /// الصفحة العامة بالرمز — تتجاوز Global Filters لأنها مجهولة، لكنها تعيد بيانات آمنة فقط
    /// (لا أسئلة ولا إجابات ولا درجات ولا تفاصيل مستأجر). متاحة فقط إن كان الاختبار منشورًا.
    /// </summary>
    public async Task<PublicQuizPageResponse?> GetPublicByCodeAsync(string publicCode, CancellationToken cancellationToken)
    {
        var quiz = await _db.Quizzes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(q => q.PublicCode == publicCode, cancellationToken);

        if (quiz is null || quiz.Status != QuizStatus.Published || quiz.CurrentPublishedVersionId is null)
        {
            return new PublicQuizPageResponse { Available = false };
        }

        var version = await _db.QuizVersions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(v => v.Items)
            .SingleOrDefaultAsync(v => v.Id == quiz.CurrentPublishedVersionId.Value, cancellationToken);

        if (version is null)
        {
            return new PublicQuizPageResponse { Available = false };
        }

        return new PublicQuizPageResponse
        {
            Title = version.TitleSnapshot,
            Description = version.DescriptionSnapshot,
            Instructions = version.InstructionsSnapshot,
            PassingPercentage = version.PassingPercentage,
            TimeMode = version.TimeMode.ToString(),
            TimeLimitSeconds = version.TimeLimitSeconds,
            QuestionCount = version.Items.Count,
            TotalPoints = version.Items.Sum(i => i.Points),
            Theme = DeserializeTheme(version.ThemeJson),
            Available = true
        };
    }

    // ---------- Helpers ----------

    private async Task<QuizDraftResponse?> LoadDraftWithItemsAsync(Guid draftId, CancellationToken cancellationToken)
    {
        var draft = await _db.QuizVersions
            .AsNoTracking()
            .Include(v => v.Items)
            .SingleOrDefaultAsync(v => v.Id == draftId, cancellationToken);

        if (draft is null)
        {
            return null;
        }

        var items = await BuildItemResponsesAsync(draft.Items.ToList(), cancellationToken);

        return new QuizDraftResponse
        {
            Id = draft.Id,
            QuizId = draft.QuizId,
            VersionNumber = draft.VersionNumber,
            Title = draft.TitleSnapshot,
            Description = draft.DescriptionSnapshot,
            Instructions = draft.InstructionsSnapshot,
            PassingPercentage = draft.PassingPercentage,
            TimeMode = draft.TimeMode.ToString(),
            TimeLimitSeconds = draft.TimeLimitSeconds,
            ShuffleQuestions = draft.ShuffleQuestions,
            ShuffleOptions = draft.ShuffleOptions,
            Theme = DeserializeTheme(draft.ThemeJson),
            Items = items,
            TotalPoints = items.Sum(i => i.Points),
            Version = draft.Version,
            UpdatedAt = draft.UpdatedAt
        };
    }

    private async Task<IReadOnlyList<QuizDraftItemResponse>> BuildItemResponsesAsync(
        List<QuizVersionItem> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var versionIds = items.Select(i => i.QuestionVersionId).Distinct().ToList();

        var versions = await _db.QuestionVersions
            .AsNoTracking()
            .Include(v => v.Options)
            .Where(v => versionIds.Contains(v.Id))
            .ToListAsync(cancellationToken);

        var versionById = versions.ToDictionary(v => v.Id);

        var questionIds = versions.Select(v => v.QuestionId).Distinct().ToList();
        var questions = await _db.Questions
            .AsNoTracking()
            .Where(q => questionIds.Contains(q.Id))
            .ToListAsync(cancellationToken);
        var questionById = questions.ToDictionary(q => q.Id);

        // أحدث رقم نسخة لكل سؤال — لكشف "توجد نسخة أحدث"
        var latestVersionNumbers = await _db.QuestionVersions
            .AsNoTracking()
            .Where(v => questionIds.Contains(v.QuestionId))
            .GroupBy(v => v.QuestionId)
            .Select(g => new { QuestionId = g.Key, Latest = g.Max(v => v.VersionNumber) })
            .ToDictionaryAsync(x => x.QuestionId, x => x.Latest, cancellationToken);

        var result = new List<QuizDraftItemResponse>();
        foreach (var item in items.OrderBy(i => i.SortOrder))
        {
            if (!versionById.TryGetValue(item.QuestionVersionId, out var version))
            {
                continue;
            }

            questionById.TryGetValue(version.QuestionId, out var question);
            var latest = latestVersionNumbers.TryGetValue(version.QuestionId, out var l) ? l : version.VersionNumber;

            result.Add(new QuizDraftItemResponse
            {
                Id = item.Id,
                QuestionVersionId = item.QuestionVersionId,
                QuestionId = version.QuestionId,
                SortOrder = item.SortOrder,
                Points = item.Points,
                IsRequired = item.IsRequired,
                QuestionType = version.QuestionType.ToString(),
                Prompt = version.Prompt,
                Explanation = version.Explanation,
                Difficulty = version.Difficulty.ToString(),
                Language = version.Language,
                ConfigJson = version.ConfigJson,
                MediaAssetId = version.MediaAssetId,
                Options = version.Options
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new QuizDraftItemOptionResponse
                    {
                        SortOrder = o.SortOrder,
                        OptionText = o.OptionText,
                        IsCorrect = o.IsCorrect
                    })
                    .ToList(),
                PinnedVersionNumber = version.VersionNumber,
                LatestVersionNumber = latest,
                SourceQuestionArchived = question?.Status == QuestionStatus.Archived
            });
        }

        return result;
    }

    /// <summary>
    /// التحقق من صلاحية المسودة للنشر: غير فارغة، كل سؤال مصدر موجود ونشط وضمن المستأجر،
    /// وكل نسخة مثبتة تجتاز QuestionValidator (بما فيه شرط الوسائط لأسئلة الاستماع).
    /// </summary>
    private async Task<ServiceResultException?> ValidateDraftForPublishAsync(
        QuizVersion draft,
        CancellationToken cancellationToken)
    {
        if (draft.Items.Count == 0)
        {
            return new ServiceResultException("QuizEmpty", "Cannot publish an empty quiz. Add at least one question.");
        }

        var versionIds = draft.Items.Select(i => i.QuestionVersionId).Distinct().ToList();
        var versions = await _db.QuestionVersions
            .AsNoTracking()
            .Include(v => v.Options)
            .Where(v => versionIds.Contains(v.Id))
            .ToListAsync(cancellationToken);

        var versionById = versions.ToDictionary(v => v.Id);

        var questionIds = versions.Select(v => v.QuestionId).Distinct().ToList();
        var questions = await _db.Questions
            .AsNoTracking()
            .Where(q => questionIds.Contains(q.Id))
            .ToDictionaryAsync(q => q.Id, cancellationToken);

        var errors = new List<string>();

        foreach (var item in draft.Items.OrderBy(i => i.SortOrder))
        {
            if (!versionById.TryGetValue(item.QuestionVersionId, out var version))
            {
                errors.Add($"Item {item.SortOrder + 1}: pinned question version is missing.");
                continue;
            }

            if (!questions.TryGetValue(version.QuestionId, out var question))
            {
                errors.Add($"Item {item.SortOrder + 1}: source question no longer exists.");
                continue;
            }

            if (question.Status == QuestionStatus.Archived)
            {
                errors.Add($"Item {item.SortOrder + 1}: source question is archived.");
                continue;
            }

            var validation = QuestionValidator.ValidateForVersion(
                version.QuestionType,
                version.Prompt,
                version.Explanation,
                version.Language,
                version.ConfigJson,
                version.Options.Select(o => new OptionSpec(o.OptionText, o.IsCorrect)).ToList(),
                version.MediaAssetId is not null);

            if (!validation.IsValid)
            {
                errors.Add($"Item {item.SortOrder + 1}: {string.Join(", ", validation.Errors)}");
            }
        }

        if (errors.Count > 0)
        {
            return new ServiceResultException("QuizInvalid", string.Join(";", errors));
        }

        return null;
    }

    /// <summary>
    /// SHA-256 حتمي على تمثيل قانوني للنسخة: حقول النسخة + العناصر مرتبة
    /// (QuestionVersionId, SortOrder, Points, IsRequired). يتغير مع أي تغيير في المحتوى.
    /// </summary>
    private static string ComputeChecksum(QuizVersion version)
    {
        var sb = new StringBuilder();
        sb.Append(version.TitleSnapshot).Append('|')
          .Append(version.DescriptionSnapshot ?? string.Empty).Append('|')
          .Append(version.InstructionsSnapshot ?? string.Empty).Append('|')
          .Append(version.PassingPercentage).Append('|')
          .Append(version.TimeMode).Append('|')
          .Append(version.TimeLimitSeconds?.ToString() ?? string.Empty).Append('|')
          .Append(version.ShuffleQuestions).Append('|')
          .Append(version.ShuffleOptions).Append('|')
          .Append(version.ThemeJson);

        foreach (var item in version.Items.OrderBy(i => i.SortOrder))
        {
            sb.Append('|')
              .Append(item.QuestionVersionId).Append(',')
              .Append(item.SortOrder).Append(',')
              .Append(item.Points).Append(',')
              .Append(item.IsRequired);
        }

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string GeneratePublicCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static string BuildShareUrl(string publicCode) => $"/q/{publicCode}";

    private static string SerializeTheme(QuizThemeInput theme) => JsonSerializer.Serialize(theme);

    private static QuizThemeInput DeserializeTheme(string themeJson)
    {
        try
        {
            return JsonSerializer.Deserialize<QuizThemeInput>(themeJson) ?? new QuizThemeInput();
        }
        catch (JsonException)
        {
            return new QuizThemeInput();
        }
    }
}

/// <summary>استعلام قائمة الاختبارات — مرشحات والبحث والترقيم.</summary>
public sealed class QuizListQuery
{
    public string? Status { get; set; }
    public string? Search { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
}
