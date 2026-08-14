using Microsoft.EntityFrameworkCore;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Questions;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Questions.Validation;
using TeacherPlatform.Domain.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Use cases بنك الأسئلة. كل القراءات تمر بـGlobal Filters (TenantId == CurrentTenantId)،
/// وكل الكتابات تمر بحارس TenantSaveGuardInterceptor:
/// - التعديل ينشئ QuestionVersion جديدة Immutable؛ القديمة لا تُلمس.
/// - BaseVersion Stale يحقق Optimistic Concurrency → 409.
/// - الأرشفة تحدّ Status فقط — لا حذف فيزيائي ولا مساس بالنسخ.
/// </summary>
public sealed class QuestionService
{
    private readonly AppDbContext _db;

    public QuestionService(AppDbContext db)
    {
        _db = db;
    }

    // ---------- Banks ----------

    public async Task<IReadOnlyList<QuestionBankResponse>> ListBanksAsync(CancellationToken cancellationToken)
    {
        return await _db.QuestionBanks
            .OrderBy(b => b.Name)
            .Select(b => new QuestionBankResponse
            {
                Id = b.Id,
                Name = b.Name,
                Description = b.Description,
                CreatedAt = b.CreatedAt,
                QuestionCount = _db.Questions.Count(q => q.BankId == b.Id && q.Status == QuestionStatus.Active)
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<(ServiceResultException? Error, QuestionBankResponse? Result)> CreateBankAsync(
        CreateQuestionBankRequest request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var bank = new QuestionBank
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.QuestionBanks.Add(bank);
        await _db.SaveChangesAsync(cancellationToken);

        return (null, new QuestionBankResponse
        {
            Id = bank.Id,
            Name = bank.Name,
            Description = bank.Description,
            CreatedAt = bank.CreatedAt,
            QuestionCount = 0
        });
    }

    public async Task<ServiceResultException?> UpdateBankAsync(
        Guid bankId,
        UpdateQuestionBankRequest request,
        CancellationToken cancellationToken)
    {
        var bank = await _db.QuestionBanks.SingleOrDefaultAsync(b => b.Id == bankId, cancellationToken);
        if (bank is null)
        {
            return new ServiceResultException("NotFound", "Question bank not found.");
        }

        bank.Name = request.Name.Trim();
        bank.Description = request.Description?.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return null;
    }

    // ---------- Tags ----------

    public async Task<IReadOnlyList<QuestionTagResponse>> ListTagsAsync(CancellationToken cancellationToken)
    {
        return await _db.QuestionTags
            .OrderBy(t => t.Name)
            .Select(t => new QuestionTagResponse
            {
                Id = t.Id,
                Name = t.Name,
                QuestionCount = t.QuestionLinks.Count
            })
            .ToListAsync(cancellationToken);
    }

    // ---------- Questions ----------

    /// <summary>
    /// قائمة الأسئلة مع البحث والمرشحات وتقسيم الصفحات. يدعم Text search على أحدث Prompt.
    /// النتائج ثابتة على pageSize بين 1 و100.
    /// </summary>
    public async Task<PagedResponse<QuestionListItemResponse>> ListQuestionsAsync(
        QuestionListQuery query,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);

        var baseQuery = _db.Questions
            .AsNoTracking()
            .Where(q => query.IncludeArchived == true || q.Status == QuestionStatus.Active);

        if (query.BankId is Guid bankId)
        {
            baseQuery = baseQuery.Where(q => q.BankId == bankId);
        }

        if (!string.IsNullOrWhiteSpace(query.Type)
            && Enum.TryParse<QuestionType>(query.Type, ignoreCase: true, out var parsedType))
        {
            baseQuery = baseQuery.Where(q => q.CurrentVersionId != null
                && _db.QuestionVersions.Any(v => v.Id == q.CurrentVersionId && v.QuestionType == parsedType));
        }

        if (!string.IsNullOrWhiteSpace(query.Difficulty)
            && Enum.TryParse<QuestionDifficulty>(query.Difficulty, ignoreCase: true, out var parsedDifficulty))
        {
            baseQuery = baseQuery.Where(q => q.CurrentVersionId != null
                && _db.QuestionVersions.Any(v => v.Id == q.CurrentVersionId && v.Difficulty == parsedDifficulty));
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            var normalizedTag = query.Tag.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(q => q.TagLinks.Any(l => l.Tag!.NormalizedName == normalizedTag));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = query.Search.Trim();
            baseQuery = baseQuery.Where(q => q.CurrentVersionId != null
                && _db.QuestionVersions.Any(v => v.Id == q.CurrentVersionId
                    && EF.Functions.ILike(v.Prompt, $"%{pattern}%")));
        }

        var total = await baseQuery.CountAsync(cancellationToken);

        var items = await baseQuery
            .OrderByDescending(q => q.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(q => new
            {
                q.Id,
                q.BankId,
                q.Status,
                q.UpdatedAt,
                Version = q.Versions.Where(v => q.CurrentVersionId == v.Id)
                    .Select(v => new { v.Id, v.QuestionType, v.Prompt, v.Difficulty, v.Language, v.VersionNumber })
                    .FirstOrDefault(),
                Tags = q.TagLinks.Select(l => l.Tag!.Name).ToList()
            })
            .ToListAsync(cancellationToken);

        var mapped = items
            .Where(x => x.Version is not null)
            .Select(x => new QuestionListItemResponse
            {
                Id = x.Id,
                BankId = x.BankId,
                Status = x.Status.ToString(),
                QuestionType = x.Version!.QuestionType.ToString(),
                Prompt = x.Version.Prompt,
                Difficulty = x.Version.Difficulty.ToString(),
                Language = x.Version.Language,
                CurrentVersionNumber = x.Version.VersionNumber,
                Tags = x.Tags,
                UpdatedAt = x.UpdatedAt
            })
            .ToList();

        return new PagedResponse<QuestionListItemResponse>
        {
            Items = mapped,
            Page = page,
            PageSize = pageSize,
            TotalItems = total,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        };
    }

    public async Task<QuestionDetailResponse?> GetQuestionAsync(Guid questionId, CancellationToken cancellationToken)
    {
        var question = await _db.Questions
            .AsNoTracking()
            .Include(q => q.TagLinks).ThenInclude(l => l.Tag)
            .SingleOrDefaultAsync(q => q.Id == questionId, cancellationToken);

        if (question is null)
        {
            return null;
        }

        VersionDetail? current = await LoadVersionDetailAsync(question.CurrentVersionId, cancellationToken);
        if (current is null)
        {
            return null;
        }

        return ToDetail(question, current);
    }

    public async Task<IReadOnlyList<QuestionVersionSummaryResponse>> ListVersionsAsync(
        Guid questionId,
        CancellationToken cancellationToken)
    {
        var exists = await _db.Questions.AsNoTracking().AnyAsync(q => q.Id == questionId, cancellationToken);
        if (!exists)
        {
            return [];
        }

        var versions = await _db.QuestionVersions
            .AsNoTracking()
            .Include(v => v.Options)
            .Where(v => v.QuestionId == questionId)
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync(cancellationToken);

        return versions.Select(ToVersionSummaryResponse).ToList();
    }

    public async Task<QuestionVersionResponse?> GetVersionAsync(
        Guid questionId,
        int versionNumber,
        CancellationToken cancellationToken)
    {
        var exists = await _db.Questions.AsNoTracking().AnyAsync(q => q.Id == questionId, cancellationToken);
        if (!exists)
        {
            return null;
        }

        var version = await _db.QuestionVersions
            .AsNoTracking()
            .Include(v => v.Options)
            .SingleOrDefaultAsync(v => v.QuestionId == questionId && v.VersionNumber == versionNumber, cancellationToken);

        if (version is null)
        {
            return null;
        }

        return ToVersionResponse(version);
    }

    /// <summary>إنشاء سؤال مع Version رقم 1 في معاملة واحدة.</summary>
    public async Task<(ServiceResultException? Error, QuestionDetailResponse? Result)> CreateQuestionAsync(
        CreateQuestionRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<QuestionType>(request.QuestionType, ignoreCase: true, out var type))
        {
            return (new ServiceResultException("UnknownQuestionType", "Question type is not supported."), null);
        }

        if (!Enum.TryParse<QuestionDifficulty>(request.Difficulty, ignoreCase: true, out var difficulty))
        {
            return (new ServiceResultException("InvalidDifficulty", "Difficulty must be Easy, Medium, or Hard."), null);
        }

        var bankExists = await _db.QuestionBanks.AnyAsync(b => b.Id == request.BankId, cancellationToken);
        if (!bankExists)
        {
            return (new ServiceResultException("NotFound", "Question bank not found."), null);
        }

        if (request.MediaAssetId is Guid mediaId)
        {
            var mediaError = await ValidateMediaReferenceAsync(mediaId, type, cancellationToken);
            if (mediaError is not null)
            {
                return (mediaError, null);
            }
        }

        var configJson = type == QuestionType.ShortAnswer
            ? QuestionValidator.BuildShortAnswerConfig(request.AcceptedAnswers ?? [])
            : "{}";

        var hasMedia = request.MediaAssetId is not null;
        var validation = ValidateInput(type, request.Prompt, request.Explanation, request.Language, configJson, request.Options, hasMedia);
        if (!validation.IsValid)
        {
            return (new ServiceResultException("QuestionInvalid", string.Join(";", validation.Errors)), null);
        }

        var now = DateTime.UtcNow;
        var questionId = Guid.NewGuid();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var question = new Question
        {
            Id = questionId,
            BankId = request.BankId,
            Status = QuestionStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Questions.Add(question);

        var version = new QuestionVersion
        {
            Id = Guid.NewGuid(),
            QuestionId = questionId,
            VersionNumber = 1,
            QuestionType = type,
            Prompt = request.Prompt.Trim(),
            Explanation = request.Explanation?.Trim(),
            Difficulty = difficulty,
            Language = request.Language,
            ConfigJson = configJson,
            MediaAssetId = request.MediaAssetId,
            CreatedAt = now,
            UpdatedAt = now,
            Options = BuildOptions(request.Options, now)
        };
        _db.QuestionVersions.Add(version);

        question.CurrentVersionId = version.Id;

        var tags = await SyncTagsAsync(question, request.Tags, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var detail = BuildDetail(question, version, tags, includeUrls: false);
        return (null, detail);
    }

    /// <summary>
    /// تعديل محتوى سؤال: ينشئ نسخة جديدة Immutable. BaseVersion يفرض Optimistic Concurrency —
    /// أي قراءة قديمة (تم تغييرها من عميل آخر) تُرفض بـConflict.
    /// </summary>
    public async Task<(ServiceResultException? Error, QuestionDetailResponse? Result)> CreateNewVersionAsync(
        Guid questionId,
        CreateQuestionVersionRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        var question = await _db.Questions
            .Include(q => q.TagLinks)
            .SingleOrDefaultAsync(q => q.Id == questionId, cancellationToken);

        if (question is null || question.Status == QuestionStatus.Archived)
        {
            return (new ServiceResultException("NotFound", "Question not found."), null);
        }

        if (request.BaseVersion is null || request.BaseVersion.Value != question.Version)
        {
            return (new ServiceResultException("Conflict", "The question was modified by someone else. Reload and try again."), null);
        }

        var currentVersion = await _db.QuestionVersions
            .AsNoTracking()
            .SingleOrDefaultAsync(v => v.Id == question.CurrentVersionId!.Value, cancellationToken);

        if (currentVersion is null)
        {
            return (new ServiceResultException("NotFound", "Question version not found."), null);
        }

        var type = currentVersion.QuestionType;

        if (!Enum.TryParse<QuestionDifficulty>(request.Difficulty, ignoreCase: true, out var difficulty))
        {
            return (new ServiceResultException("InvalidDifficulty", "Difficulty must be Easy, Medium, or Hard."), null);
        }

        if (request.MediaAssetId is Guid mediaId)
        {
            var mediaError = await ValidateMediaReferenceAsync(mediaId, type, cancellationToken);
            if (mediaError is not null)
            {
                return (mediaError, null);
            }
        }

        var configJson = type == QuestionType.ShortAnswer
            ? QuestionValidator.BuildShortAnswerConfig(request.AcceptedAnswers ?? [])
            : currentVersion.ConfigJson;

        var hasMedia = request.MediaAssetId is not null || currentVersion.MediaAssetId is not null;

        var validation = ValidateInput(type, request.Prompt, request.Explanation, request.Language, configJson, request.Options, hasMedia);
        if (!validation.IsValid)
        {
            return (new ServiceResultException("QuestionInvalid", string.Join(";", validation.Errors)), null);
        }

        var nextVersionNumber = await _db.QuestionVersions
            .Where(v => v.QuestionId == questionId)
            .MaxAsync(v => (int?)v.VersionNumber, cancellationToken) ?? 0;

        var now = DateTime.UtcNow;
        var mediaToUse = request.MediaAssetId ?? currentVersion.MediaAssetId;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var newVersion = new QuestionVersion
        {
            Id = Guid.NewGuid(),
            QuestionId = questionId,
            VersionNumber = nextVersionNumber + 1,
            QuestionType = type,
            Prompt = request.Prompt.Trim(),
            Explanation = request.Explanation?.Trim(),
            Difficulty = difficulty,
            Language = request.Language,
            ConfigJson = configJson,
            MediaAssetId = mediaToUse,
            CreatedAt = now,
            UpdatedAt = now,
            Options = BuildOptions(request.Options, now)
        };
        _db.QuestionVersions.Add(newVersion);

        question.CurrentVersionId = newVersion.Id;
        question.UpdatedAt = now;

        var tags = await SyncTagsAsync(question, request.Tags, now, cancellationToken);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (new ServiceResultException("Conflict", "The question was modified by someone else. Reload and try again."), null);
        }

        var detail = BuildDetail(question, newVersion, tags, includeUrls: false);
        return (null, detail);
    }

    /// <summary>أرشفة السؤال — لا تحذف ولا تمس النسخ ولا الوسائط.</summary>
    public async Task<ServiceResultException?> ArchiveQuestionAsync(Guid questionId, CancellationToken cancellationToken)
    {
        var question = await _db.Questions.SingleOrDefaultAsync(q => q.Id == questionId, cancellationToken);
        if (question is null)
        {
            return new ServiceResultException("NotFound", "Question not found.");
        }

        if (question.Status == QuestionStatus.Archived)
        {
            return null; // Idempotent
        }

        question.Status = QuestionStatus.Archived;
        question.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return null;
    }

    // ---------- Helpers ----------

    private sealed record VersionDetail(QuestionVersion Version, List<QuestionOption> Options);

    private async Task<VersionDetail?> LoadVersionDetailAsync(Guid? versionId, CancellationToken cancellationToken)
    {
        if (versionId is null)
        {
            return null;
        }

        var version = await _db.QuestionVersions
            .AsNoTracking()
            .Include(v => v.Options)
            .SingleOrDefaultAsync(v => v.Id == versionId.Value, cancellationToken);

        return version is null ? null : new VersionDetail(version, version.Options.ToList());
    }

    private QuestionDetailResponse BuildDetail(
        Question question,
        QuestionVersion version,
        IReadOnlyList<string> tags,
        bool includeUrls)
    {
        var options = version.Options
            .OrderBy(o => o.SortOrder)
            .Select(o => new QuestionOptionResponse
            {
                Id = o.Id,
                SortOrder = o.SortOrder,
                OptionText = o.OptionText,
                IsCorrect = o.IsCorrect
            })
            .ToList();

        var validation = EvaluateVersion(version, options);

        return new QuestionDetailResponse
        {
            Id = question.Id,
            BankId = question.BankId,
            Status = question.Status.ToString(),
            CurrentVersionNumber = version.VersionNumber,
            Tags = tags,
            Version = question.Version,
            CreatedAt = question.CreatedAt,
            UpdatedAt = question.UpdatedAt,
            CurrentVersion = new QuestionVersionResponse
            {
                Id = version.Id,
                VersionNumber = version.VersionNumber,
                QuestionType = version.QuestionType.ToString(),
                Prompt = version.Prompt,
                Explanation = version.Explanation,
                Difficulty = version.Difficulty.ToString(),
                Language = version.Language,
                ConfigJson = version.ConfigJson,
                MediaAssetId = version.MediaAssetId,
                IsValid = validation.IsValid,
                ValidationErrors = validation.Errors,
                Options = options,
                CreatedAt = version.CreatedAt
            }
        };
    }

    private QuestionDetailResponse ToDetail(Question question, VersionDetail detail)
    {
        return BuildDetail(question, detail.Version, question.TagLinks.Select(l => l.Tag!.Name).ToList(), includeUrls: false);
    }

    private QuestionVersionResponse ToVersionResponse(QuestionVersion version)
    {
        var options = version.Options.OrderBy(o => o.SortOrder).Select(o => new QuestionOptionResponse
        {
            Id = o.Id,
            SortOrder = o.SortOrder,
            OptionText = o.OptionText,
            IsCorrect = o.IsCorrect
        }).ToList();

        var validation = EvaluateVersion(version, options);
        return new QuestionVersionResponse
        {
            Id = version.Id,
            VersionNumber = version.VersionNumber,
            QuestionType = version.QuestionType.ToString(),
            Prompt = version.Prompt,
            Explanation = version.Explanation,
            Difficulty = version.Difficulty.ToString(),
            Language = version.Language,
            ConfigJson = version.ConfigJson,
            MediaAssetId = version.MediaAssetId,
            IsValid = validation.IsValid,
            ValidationErrors = validation.Errors,
            Options = options,
            CreatedAt = version.CreatedAt
        };
    }

    private static QuestionVersionSummaryResponse ToVersionSummaryResponse(QuestionVersion version)
    {
        var options = version.Options
            .OrderBy(option => option.SortOrder)
            .Select(option => new QuestionOptionResponse
            {
                Id = option.Id,
                SortOrder = option.SortOrder,
                OptionText = option.OptionText,
                IsCorrect = option.IsCorrect
            })
            .ToList();

        return new QuestionVersionSummaryResponse
        {
            Id = version.Id,
            VersionNumber = version.VersionNumber,
            QuestionType = version.QuestionType.ToString(),
            Prompt = version.Prompt,
            IsValid = EvaluateVersion(version, options).IsValid,
            CreatedAt = version.CreatedAt
        };
    }

    private static QuestionValidationResult EvaluateVersion(QuestionVersion version, IReadOnlyList<QuestionOptionResponse> options)
    {
        return QuestionValidator.ValidateForVersion(
            version.QuestionType,
            version.Prompt,
            version.Explanation,
            version.Language,
            version.ConfigJson,
            options.Select(o => new OptionSpec(o.OptionText, o.IsCorrect)).ToList(),
            version.MediaAssetId is not null);
    }

    private static QuestionValidationResult ValidateInput(
        QuestionType type,
        string prompt,
        string? explanation,
        string language,
        string configJson,
        QuestionOptionInput[] options,
        bool hasMedia)
    {
        return QuestionValidator.ValidateForVersion(
            type,
            prompt,
            explanation,
            language,
            configJson,
            options.Select(o => new OptionSpec(o.Text, o.IsCorrect)).ToList(),
            hasMedia);
    }

    private static List<QuestionOption> BuildOptions(QuestionOptionInput[] input, DateTime now)
    {
        var result = new List<QuestionOption>();
        for (var i = 0; i < input.Length; i++)
        {
            result.Add(new QuestionOption
            {
                Id = Guid.NewGuid(),
                SortOrder = i,
                OptionText = input[i].Text.Trim(),
                IsCorrect = input[i].IsCorrect,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        return result;
    }

    private async Task<List<string>> SyncTagsAsync(
        Question question,
        string[] requestedTags,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var incoming = requestedTags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();

        // حذف الروابط غير المطلوبة
        var existingLinks = await _db.QuestionTagLinks
            .Where(l => l.QuestionId == question.Id)
            .ToListAsync(cancellationToken);

        var byTagId = await _db.QuestionTags
            .Where(t => incoming.Select(i => i.ToLowerInvariant()).Contains(t.NormalizedName))
            .ToListAsync(cancellationToken);

        var resolvedTags = new List<QuestionTag>(byTagId);

        foreach (var name in incoming)
        {
            var normalized = name.ToLowerInvariant();
            if (byTagId.All(t => t.NormalizedName != normalized))
            {
                var tag = new QuestionTag
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    NormalizedName = normalized,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _db.QuestionTags.Add(tag);
                resolvedTags.Add(tag);
            }
        }

        // إزالة روابط لم تعد مطلوبة
        var wantedTagIds = resolvedTags.Select(t => t.Id).ToHashSet();
        var toRemove = existingLinks.Where(l => !wantedTagIds.Contains(l.TagId)).ToList();
        if (toRemove.Count > 0)
        {
            _db.QuestionTagLinks.RemoveRange(toRemove);
        }

        // إضافة روابط جديدة
        var existingTagIds = existingLinks.Select(l => l.TagId).ToHashSet();
        foreach (var tag in resolvedTags.Where(t => !existingTagIds.Contains(t.Id)))
        {
            _db.QuestionTagLinks.Add(new QuestionTagLink
            {
                QuestionId = question.Id,
                TagId = tag.Id,
                TenantId = question.TenantId
            });
        }

        return resolvedTags.OrderBy(t => t.Name).Select(t => t.Name).ToList();
    }

    private async Task<ServiceResultException?> ValidateMediaReferenceAsync(
        Guid mediaAssetId,
        QuestionType type,
        CancellationToken cancellationToken)
    {
        var asset = await _db.MediaAssets
            .AsNoTracking()
            .SingleOrDefaultAsync(a => a.Id == mediaAssetId, cancellationToken);

        if (asset is null)
        {
            return new ServiceResultException("NotFound", "Media asset not found.");
        }

        if (type == QuestionType.Listening)
        {
            if (asset.Kind != Domain.Media.MediaKind.Audio)
            {
                return new ServiceResultException("InvalidMediaKind", "Listening questions require an audio file.");
            }
        }
        else if (asset.Kind != Domain.Media.MediaKind.Image)
        {
            return new ServiceResultException("InvalidMediaKind", "Only image media is supported for this question type.");
        }

        return null;
    }
}

/// <summary>استعلام قائمة الأسئلة — مرشحات والبحث والترقيم.</summary>
public sealed class QuestionListQuery
{
    public Guid? BankId { get; set; }
    public string? Type { get; set; }
    public string? Difficulty { get; set; }
    public string? Tag { get; set; }
    public string? Search { get; set; }
    public bool? IncludeArchived { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
}
