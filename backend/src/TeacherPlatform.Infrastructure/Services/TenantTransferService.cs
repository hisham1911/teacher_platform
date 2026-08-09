using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Media;
using TeacherPlatform.Application.Options;
using TeacherPlatform.Application.Saas;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Domain.Certificates;
using TeacherPlatform.Domain.Media;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Quizzes;
using TeacherPlatform.Domain.Saas;
using TeacherPlatform.Domain.Surveys;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

public sealed record TenantExportArchive(Stream Content, string FileName);

public sealed record TenantImportRequest(
    Guid TenantId,
    Guid ActorUserId,
    Stream Source,
    long ArchiveLength,
    bool DryRun,
    string? RequestId);

/// <summary>
/// Portable tenant-owned content transfer. Authentication data, attempts, responses,
/// platform roles, subscriptions, audit entries, and secrets are intentionally excluded.
/// </summary>
public sealed class TenantTransferService
{
    public const int CurrentFormatVersion = 1;
    public const long MaxArchiveBytes = 250L * 1024 * 1024;
    private const long MaxExpandedBytes = 500L * 1024 * 1024;
    private const int MaxEntries = 5_000;
    private const long MaxJsonEntryBytes = 20L * 1024 * 1024;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        WriteIndented = true,
        MaxDepth = 64
    };

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IObjectStorage _storage;
    private readonly StorageOptions _storageOptions;
    private readonly PlanLimitResolver _planLimits;
    private readonly IClock _clock;
    private readonly ILogger<TenantTransferService> _logger;

    public TenantTransferService(
        AppDbContext db,
        ITenantContext tenantContext,
        IObjectStorage storage,
        IOptions<StorageOptions> storageOptions,
        PlanLimitResolver planLimits,
        IClock clock,
        ILogger<TenantTransferService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _storage = storage;
        _storageOptions = storageOptions.Value;
        _planLimits = planLimits;
        _clock = clock;
        _logger = logger;
    }

    public async Task<TenantExportArchive> ExportAsync(
        Guid tenantId,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        EnsureTenant(tenantId);
        var content = await LoadExportContentAsync(cancellationToken);
        var exportedAt = _clock.UtcNow;
        var manifest = new TenantExportManifest
        {
            ExportedAt = exportedAt,
            TenantId = tenantId,
            AppVersion = Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "unknown",
            Counts = BuildCounts(content.Questions, content.Quizzes, content.Surveys, content.Templates)
        };
        var file = CreateTemporaryExportFile();

        try
        {
            await WriteExportArchiveAsync(file, content, manifest, cancellationToken);
            AddExportAudit(tenantId, actorUserId, manifest, exportedAt);
            await _db.SaveChangesAsync(cancellationToken);
            file.Position = 0;
            return new TenantExportArchive(file, $"tenant-export-{exportedAt:yyyy-MM-dd}.zip");
        }
        catch
        {
            await file.DisposeAsync();
            throw;
        }
    }

    private async Task<ExportContent> LoadExportContentAsync(CancellationToken cancellationToken)
    {
        var mediaSources = await _db.MediaAssets.AsNoTracking()
            .OrderBy(asset => asset.CreatedAt)
            .Select(asset => new ExportMediaSource(
                new ExportMediaAsset(
                    asset.Id, BuildMediaArchivePath(asset), asset.MimeType,
                    asset.SizeBytes, asset.Kind, asset.OriginalFileName),
                asset.ObjectKey))
            .ToListAsync(cancellationToken);
        return new ExportContent(
            await LoadQuestionsExportAsync(mediaSources, cancellationToken),
            await LoadQuizzesExportAsync(cancellationToken),
            await LoadSurveysExportAsync(cancellationToken),
            await LoadTemplatesExportAsync(cancellationToken),
            mediaSources.ToDictionary(source => source.Asset.Id, source => source.ObjectKey));
    }

    private async Task<TenantQuestionsExport> LoadQuestionsExportAsync(
        IReadOnlyList<ExportMediaSource> mediaSources,
        CancellationToken cancellationToken) =>
        new()
        {
            Banks = await _db.QuestionBanks.AsNoTracking().OrderBy(bank => bank.CreatedAt)
                .Select(bank => new ExportQuestionBank(bank.Id, bank.Name, bank.Description))
                .ToListAsync(cancellationToken),
            Media = mediaSources.Select(source => source.Asset).ToList(),
            Questions = await _db.Questions.AsNoTracking().OrderBy(question => question.CreatedAt)
                .Select(question => new ExportQuestion(
                    question.Id, question.BankId, question.Status, question.CurrentVersionId))
                .ToListAsync(cancellationToken),
            Versions = await _db.QuestionVersions.AsNoTracking().OrderBy(version => version.CreatedAt)
                .Select(version => new ExportQuestionVersion(
                    version.Id, version.QuestionId, version.VersionNumber, version.QuestionType,
                    version.Prompt, version.Explanation, version.Difficulty, version.Language,
                    version.ConfigJson, version.MediaAssetId))
                .ToListAsync(cancellationToken),
            Options = await _db.QuestionOptions.AsNoTracking().OrderBy(option => option.CreatedAt)
                .Select(option => new ExportQuestionOption(
                    option.Id, option.QuestionVersionId, option.SortOrder, option.OptionText, option.IsCorrect))
                .ToListAsync(cancellationToken),
            Tags = await _db.QuestionTags.AsNoTracking().OrderBy(tag => tag.NormalizedName)
                .Select(tag => new ExportQuestionTag(tag.Id, tag.Name, tag.NormalizedName))
                .ToListAsync(cancellationToken),
            TagLinks = await _db.QuestionTagLinks.AsNoTracking()
                .Select(link => new ExportQuestionTagLink(link.QuestionId, link.TagId))
                .ToListAsync(cancellationToken)
        };

    private async Task<TenantQuizzesExport> LoadQuizzesExportAsync(CancellationToken cancellationToken) =>
        new()
        {
            Quizzes = await _db.Quizzes.AsNoTracking().OrderBy(quiz => quiz.CreatedAt)
                .Select(quiz => new ExportQuiz(
                    quiz.Id, quiz.Title, quiz.Slug, quiz.Description, quiz.Status,
                    quiz.CurrentDraftVersionId, quiz.CurrentPublishedVersionId,
                    quiz.SubjectId, quiz.GradeId))
                .ToListAsync(cancellationToken),
            Versions = await _db.QuizVersions.AsNoTracking().OrderBy(version => version.CreatedAt)
                .Select(version => new ExportQuizVersion(
                    version.Id, version.QuizId, version.VersionNumber, version.Status,
                    version.TitleSnapshot, version.DescriptionSnapshot, version.InstructionsSnapshot,
                    version.PassingPercentage, version.TimeMode, version.TimeLimitSeconds,
                    version.ShuffleQuestions, version.ShuffleOptions, version.ThemeJson, version.PublishedAt))
                .ToListAsync(cancellationToken),
            Items = await _db.QuizVersionItems.AsNoTracking().OrderBy(item => item.CreatedAt)
                .Select(item => new ExportQuizVersionItem(
                    item.Id, item.QuizVersionId, item.QuestionVersionId,
                    item.SortOrder, item.Points, item.IsRequired))
                .ToListAsync(cancellationToken)
        };

    private async Task<TenantSurveysExport> LoadSurveysExportAsync(CancellationToken cancellationToken) =>
        new()
        {
            Surveys = await _db.Surveys.AsNoTracking().OrderBy(survey => survey.CreatedAt)
                .Select(survey => new ExportSurvey(
                    survey.Id, survey.QuizId, survey.Title, survey.Description,
                    survey.Status, survey.PublishedAt))
                .ToListAsync(cancellationToken),
            Questions = await _db.SurveyQuestions.AsNoTracking().OrderBy(question => question.CreatedAt)
                .Select(question => new ExportSurveyQuestion(
                    question.Id, question.SurveyId, question.SortOrder,
                    question.QuestionType, question.Prompt, question.IsRequired))
                .ToListAsync(cancellationToken),
            Options = await _db.SurveyOptions.AsNoTracking().OrderBy(option => option.CreatedAt)
                .Select(option => new ExportSurveyOption(
                    option.Id, option.SurveyQuestionId, option.SortOrder, option.OptionText))
                .ToListAsync(cancellationToken)
        };

    private Task<List<ExportCertificateTemplate>> LoadTemplatesExportAsync(CancellationToken cancellationToken) =>
        _db.CertificateTemplates.AsNoTracking().OrderBy(template => template.CreatedAt)
            .Select(template => new ExportCertificateTemplate(
                template.Id, template.Name, template.TitleText, template.BodyText,
                template.IssuerName, template.PrimaryColor, template.SecondaryColor, template.IsDefault))
            .ToListAsync(cancellationToken);

    private async Task WriteExportArchiveAsync(
        Stream file,
        ExportContent content,
        TenantExportManifest manifest,
        CancellationToken cancellationToken)
    {
        using var archive = new ZipArchive(file, ZipArchiveMode.Create, leaveOpen: true);
        await WriteJsonEntryAsync(archive, "questions.json", content.Questions, manifest.Checksums, cancellationToken);
        await WriteJsonEntryAsync(archive, "quizzes.json", content.Quizzes, manifest.Checksums, cancellationToken);
        await WriteJsonEntryAsync(archive, "surveys.json", content.Surveys, manifest.Checksums, cancellationToken);
        await WriteJsonEntryAsync(
            archive, "certificate-templates.json", content.Templates, manifest.Checksums, cancellationToken);
        foreach (var asset in content.Questions.Media)
        {
            await using var source = await _storage.OpenReadAsync(content.MediaObjectKeys[asset.Id], cancellationToken);
            var entry = archive.CreateEntry(asset.ArchivePath, CompressionLevel.Fastest);
            await using var target = entry.Open();
            manifest.Checksums[asset.ArchivePath] = await CopyAndHashAsync(source, target, cancellationToken);
        }
        var manifestEntry = archive.CreateEntry("manifest.json", CompressionLevel.Fastest);
        await using var manifestStream = manifestEntry.Open();
        await JsonSerializer.SerializeAsync(manifestStream, manifest, JsonOptions, cancellationToken);
    }

    private void AddExportAudit(
        Guid tenantId,
        Guid actorUserId,
        TenantExportManifest manifest,
        DateTime createdAt) =>
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ActorUserId = actorUserId,
            Action = "TenantContentExported",
            EntityType = "Tenant",
            EntityId = tenantId.ToString(),
            MetadataJson = JsonSerializer.Serialize(manifest.Counts),
            CreatedAt = createdAt
        });

    private static FileStream CreateTemporaryExportFile()
    {
        var path = Path.Combine(Path.GetTempPath(), $"teacher-platform-export-{Guid.NewGuid():N}.zip");
        return new FileStream(
            path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None,
            81920, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
    }

    public async Task<TenantTransferSummary> ImportAsync(
        TenantImportRequest request,
        CancellationToken cancellationToken)
    {
        EnsureTenant(request.TenantId);
        if (request.ArchiveLength <= 0 || request.ArchiveLength > MaxArchiveBytes)
        {
            throw new ServiceResultException("FileTooLarge", "Import archive is empty or exceeds 250 MB.");
        }

        var tempPath = Path.Combine(Path.GetTempPath(), $"teacher-platform-import-{Guid.NewGuid():N}.zip");
        await using var temp = new FileStream(
            tempPath,
            FileMode.CreateNew,
            FileAccess.ReadWrite,
            FileShare.None,
            81920,
            FileOptions.Asynchronous | FileOptions.DeleteOnClose);
        await CopyWithLimitAsync(request.Source, temp, MaxArchiveBytes, cancellationToken);
        temp.Position = 0;

        using var archive = OpenZipArchive(temp);
        var entries = ValidateArchiveEntries(archive);
        var manifest = await ReadJsonAsync<TenantExportManifest>(
            RequireEntry(entries, "manifest.json"), MaxJsonEntryBytes, cancellationToken);
        if (manifest.FormatVersion != CurrentFormatVersion)
        {
            throw new ServiceResultException("InvalidImport", "Unsupported tenant export format version.");
        }

        await ValidateChecksumsAsync(entries, manifest, cancellationToken);
        var questions = await ReadJsonAsync<TenantQuestionsExport>(
            RequireEntry(entries, "questions.json"), MaxJsonEntryBytes, cancellationToken);
        var quizzes = await ReadJsonAsync<TenantQuizzesExport>(
            RequireEntry(entries, "quizzes.json"), MaxJsonEntryBytes, cancellationToken);
        var surveys = await ReadJsonAsync<TenantSurveysExport>(
            RequireEntry(entries, "surveys.json"), MaxJsonEntryBytes, cancellationToken);
        var templates = await ReadJsonAsync<List<ExportCertificateTemplate>>(
            RequireEntry(entries, "certificate-templates.json"), MaxJsonEntryBytes, cancellationToken);

        var counts = BuildCounts(questions, quizzes, surveys, templates);
        ValidateManifestCounts(manifest.Counts, counts);
        ValidateReferences(questions, quizzes, surveys, templates);
        var mediaValidation = ValidateMediaEntries(entries, questions.Media);
        await ValidateLimitsAsync(request.TenantId, questions, quizzes, cancellationToken);

        var summary = new TenantTransferSummary
        {
            DryRun = request.DryRun,
            SourceTenantId = manifest.TenantId,
            TargetTenantId = request.TenantId,
            Counts = counts
        };
        if (request.DryRun)
        {
            return summary;
        }

        await ImportValidatedAsync(new ValidatedImport(
            request.TenantId,
            request.ActorUserId,
            request.RequestId,
            entries,
            questions,
            quizzes,
            surveys,
            templates,
            mediaValidation), cancellationToken);
        return summary;
    }

    private async Task ImportValidatedAsync(
        ValidatedImport import,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var ids = new ImportIdMap(import);
        var build = new ImportBuildContext(import, ids, now);
        var uploadedKeys = new List<string>();
        try
        {
            var media = await UploadMediaAsync(build, uploadedKeys, cancellationToken);
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            var roots = await BuildRootEntitiesAsync(build, media, cancellationToken);
            AddRootEntities(roots);
            await _db.SaveChangesAsync(cancellationToken);
            AddContentEntities(BuildContentEntities(build));
            await _db.SaveChangesAsync(cancellationToken);
            ApplyCurrentVersionPointers(build, roots);
            AddImportAudit(import, now);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await DeleteUploadedObjectsAsync(uploadedKeys);
            throw;
        }
    }

    private async Task<List<MediaAsset>> UploadMediaAsync(
        ImportBuildContext build,
        ICollection<string> uploadedKeys,
        CancellationToken cancellationToken)
    {
        var (import, ids, now) = build;
        var media = new List<MediaAsset>();
        foreach (var sourceAsset in import.Questions.Media)
        {
            var outcome = import.MediaValidation[sourceAsset.Id];
            var objectKey = $"tenant-assets/{import.TenantId:D}/imports/{ids.Media[sourceAsset.Id]:N}/original{outcome.SafeExtension}";
            await using var content = import.Entries[sourceAsset.ArchivePath].Open();
            await _storage.UploadAsync(objectKey, content, sourceAsset.MimeType, cancellationToken);
            uploadedKeys.Add(objectKey);
            media.Add(new MediaAsset
            {
                Id = ids.Media[sourceAsset.Id],
                TenantId = import.TenantId,
                ObjectKey = objectKey,
                MimeType = sourceAsset.MimeType,
                SizeBytes = sourceAsset.SizeBytes,
                Kind = outcome.Kind,
                Status = MediaAssetStatus.Active,
                OriginalFileName = Path.GetFileName(sourceAsset.OriginalFileName),
                CreatedBy = import.ActorUserId,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        return media;
    }

    private async Task<ImportRoots> BuildRootEntitiesAsync(
        ImportBuildContext build,
        List<MediaAsset> media,
        CancellationToken cancellationToken)
    {
        var (import, ids, now) = build;
        var tags = await ResolveTagsAsync(build, cancellationToken);
        var quizzes = await BuildQuizEntitiesAsync(build, cancellationToken);
        var templates = await BuildTemplateEntitiesAsync(build, cancellationToken);
        var banks = import.Questions.Banks.Select(bank => new QuestionBank
        {
            Id = ids.Banks[bank.Id],
            TenantId = import.TenantId,
            Name = bank.Name,
            Description = bank.Description,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        var questions = import.Questions.Questions.Select(question => new Question
        {
            Id = ids.Questions[question.Id],
            TenantId = import.TenantId,
            BankId = ids.Banks[question.BankId],
            Status = question.Status,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        return new ImportRoots(media, tags, banks, questions, quizzes, templates);
    }

    private async Task<List<QuestionTag>> ResolveTagsAsync(
        ImportBuildContext build,
        CancellationToken cancellationToken)
    {
        var (import, ids, now) = build;
        var existingTags = await _db.QuestionTags.ToDictionaryAsync(
            tag => tag.NormalizedName, tag => tag.Id, StringComparer.Ordinal, cancellationToken);
        var newTags = new List<QuestionTag>();
        foreach (var sourceTag in import.Questions.Tags)
        {
            if (!existingTags.TryGetValue(sourceTag.NormalizedName, out var tagId))
            {
                tagId = Guid.NewGuid();
                existingTags[sourceTag.NormalizedName] = tagId;
                newTags.Add(new QuestionTag
                {
                    Id = tagId,
                    TenantId = import.TenantId,
                    Name = sourceTag.Name,
                    NormalizedName = sourceTag.NormalizedName,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            ids.Tags[sourceTag.Id] = tagId;
        }
        return newTags;
    }

    private async Task<Dictionary<Guid, Quiz>> BuildQuizEntitiesAsync(
        ImportBuildContext build,
        CancellationToken cancellationToken)
    {
        var (import, ids, now) = build;
        var usedSlugs = await _db.Quizzes.Select(quiz => quiz.NormalizedSlug)
            .ToHashSetAsync(StringComparer.Ordinal, cancellationToken);
        var entities = new Dictionary<Guid, Quiz>();
        foreach (var sourceQuiz in import.Quizzes.Quizzes)
        {
            var slug = MakeUniqueSlug(sourceQuiz.Slug, sourceQuiz.Id, usedSlugs);
            entities[sourceQuiz.Id] = new Quiz
            {
                Id = ids.Quizzes[sourceQuiz.Id],
                TenantId = import.TenantId,
                Title = sourceQuiz.Title,
                Slug = slug,
                NormalizedSlug = slug.ToLowerInvariant(),
                Description = sourceQuiz.Description,
                Status = sourceQuiz.Status,
                PublicCode = GeneratePublicCode(),
                SubjectId = null,
                GradeId = null,
                CreatedAt = now,
                UpdatedAt = now
            };
        }
        return entities;
    }

    private async Task<List<CertificateTemplate>> BuildTemplateEntitiesAsync(
        ImportBuildContext build,
        CancellationToken cancellationToken)
    {
        var (import, _, now) = build;
        var usedNames = await _db.CertificateTemplates.Select(template => template.Name)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        var hasDefault = await _db.CertificateTemplates.AnyAsync(template => template.IsDefault, cancellationToken);
        var entities = new List<CertificateTemplate>();
        foreach (var source in import.Templates)
        {
            var isDefault = source.IsDefault && !hasDefault;
            hasDefault |= isDefault;
            entities.Add(new CertificateTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = import.TenantId,
                Name = MakeUniqueName(source.Name, source.Id, usedNames, 120),
                TitleText = source.TitleText,
                BodyText = source.BodyText,
                IssuerName = source.IssuerName,
                PrimaryColor = source.PrimaryColor,
                SecondaryColor = source.SecondaryColor,
                IsDefault = isDefault,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        return entities;
    }

    private void AddRootEntities(ImportRoots roots)
    {
        _db.MediaAssets.AddRange(roots.Media);
        _db.QuestionTags.AddRange(roots.Tags);
        _db.QuestionBanks.AddRange(roots.Banks);
        _db.Questions.AddRange(roots.Questions);
        _db.Quizzes.AddRange(roots.Quizzes.Values);
        _db.CertificateTemplates.AddRange(roots.Templates);
    }

    private static ImportContentEntities BuildContentEntities(
        ImportBuildContext build)
    {
        var (import, ids, now) = build;
        var questionVersions = BuildQuestionVersions(import, ids, now);
        var questionOptions = import.Questions.Options.Select(option => new QuestionOption
        {
            Id = Guid.NewGuid(),
            TenantId = import.TenantId,
            QuestionVersionId = ids.QuestionVersions[option.QuestionVersionId],
            SortOrder = option.SortOrder,
            OptionText = option.OptionText,
            IsCorrect = option.IsCorrect,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        var tagLinks = import.Questions.TagLinks.Select(link => new QuestionTagLink
        {
            TenantId = import.TenantId,
            QuestionId = ids.Questions[link.QuestionId],
            TagId = ids.Tags[link.TagId]
        }).ToList();
        var (quizVersions, quizItems) = BuildQuizContent(import, ids, now);
        var (surveyEntities, surveyQuestions, surveyOptions) = BuildSurveyContent(import, ids, now);
        return new ImportContentEntities(
            questionVersions, questionOptions, tagLinks, quizVersions, quizItems,
            surveyEntities, surveyQuestions, surveyOptions);
    }

    private static Dictionary<Guid, QuestionVersion> BuildQuestionVersions(
        ValidatedImport import,
        ImportIdMap ids,
        DateTime now) =>
        import.Questions.Versions.ToDictionary(source => source.Id, source => new QuestionVersion
        {
            Id = ids.QuestionVersions[source.Id],
            TenantId = import.TenantId,
            QuestionId = ids.Questions[source.QuestionId],
            VersionNumber = source.VersionNumber,
            QuestionType = source.QuestionType,
            Prompt = source.Prompt,
            Explanation = source.Explanation,
            Difficulty = source.Difficulty,
            Language = source.Language,
            ConfigJson = source.ConfigJson,
            MediaAssetId = source.MediaAssetId is Guid mediaId ? ids.Media[mediaId] : null,
            CreatedAt = now,
            UpdatedAt = now
        });

    private static (Dictionary<Guid, QuizVersion> Versions, List<QuizVersionItem> Items) BuildQuizContent(
        ValidatedImport import,
        ImportIdMap ids,
        DateTime now)
    {
        var versions = import.Quizzes.Versions.ToDictionary(source => source.Id, source => new QuizVersion
        {
            Id = ids.QuizVersions[source.Id],
            TenantId = import.TenantId,
            QuizId = ids.Quizzes[source.QuizId],
            VersionNumber = source.VersionNumber,
            Status = source.Status,
            TitleSnapshot = source.TitleSnapshot,
            DescriptionSnapshot = source.DescriptionSnapshot,
            InstructionsSnapshot = source.InstructionsSnapshot,
            PassingPercentage = source.PassingPercentage,
            TimeMode = source.TimeMode,
            TimeLimitSeconds = source.TimeLimitSeconds,
            ShuffleQuestions = source.ShuffleQuestions,
            ShuffleOptions = source.ShuffleOptions,
            ThemeJson = source.ThemeJson,
            PublishedAt = source.PublishedAt,
            CreatedAt = now,
            UpdatedAt = now
        });
        var items = import.Quizzes.Items.Select(source => new QuizVersionItem
        {
            Id = Guid.NewGuid(),
            TenantId = import.TenantId,
            QuizVersionId = ids.QuizVersions[source.QuizVersionId],
            QuestionVersionId = ids.QuestionVersions[source.QuestionVersionId],
            SortOrder = source.SortOrder,
            Points = source.Points,
            IsRequired = source.IsRequired,
            CreatedAt = now
        }).ToList();
        var versionsByTargetId = versions.Values.ToDictionary(version => version.Id);
        foreach (var item in items) versionsByTargetId[item.QuizVersionId].Items.Add(item);
        foreach (var version in versions.Values.Where(version => version.Status != QuizVersionStatus.Draft))
            version.Checksum = ComputeQuizChecksum(version);
        return (versions, items);
    }

    private static (Dictionary<Guid, Survey> Surveys, List<SurveyQuestion> Questions, List<SurveyOption> Options)
        BuildSurveyContent(ValidatedImport import, ImportIdMap ids, DateTime now)
    {
        var surveyEntities = import.Surveys.Surveys.ToDictionary(source => source.Id, source => new Survey
        {
            Id = ids.Surveys[source.Id],
            TenantId = import.TenantId,
            QuizId = ids.Quizzes[source.QuizId],
            Title = source.Title,
            Description = source.Description,
            Status = source.Status,
            PublishedAt = source.PublishedAt,
            CreatedAt = now,
            UpdatedAt = now
        });
        var questions = import.Surveys.Questions.Select(source => new SurveyQuestion
        {
            Id = ids.SurveyQuestions[source.Id],
            TenantId = import.TenantId,
            SurveyId = ids.Surveys[source.SurveyId],
            SortOrder = source.SortOrder,
            QuestionType = source.QuestionType,
            Prompt = source.Prompt,
            IsRequired = source.IsRequired,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        var options = import.Surveys.Options.Select(source => new SurveyOption
        {
            Id = Guid.NewGuid(),
            TenantId = import.TenantId,
            SurveyQuestionId = ids.SurveyQuestions[source.SurveyQuestionId],
            SortOrder = source.SortOrder,
            OptionText = source.OptionText,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        return (surveyEntities, questions, options);
    }

    private void AddContentEntities(ImportContentEntities entities)
    {
        _db.QuestionVersions.AddRange(entities.QuestionVersions.Values);
        _db.QuestionOptions.AddRange(entities.QuestionOptions);
        _db.QuestionTagLinks.AddRange(entities.TagLinks);
        _db.QuizVersions.AddRange(entities.QuizVersions.Values);
        _db.QuizVersionItems.AddRange(entities.QuizItems);
        _db.Surveys.AddRange(entities.Surveys.Values);
        _db.SurveyQuestions.AddRange(entities.SurveyQuestions);
        _db.SurveyOptions.AddRange(entities.SurveyOptions);
    }

    private static void ApplyCurrentVersionPointers(
        ImportBuildContext build,
        ImportRoots roots)
    {
        var (import, ids, _) = build;
        var questionsById = roots.Questions.ToDictionary(question => question.Id);
        foreach (var source in import.Questions.Questions)
            questionsById[ids.Questions[source.Id]].CurrentVersionId = source.CurrentVersionId is Guid versionId
                ? ids.QuestionVersions[versionId] : null;
        foreach (var source in import.Quizzes.Quizzes)
        {
            var target = roots.Quizzes[source.Id];
            target.CurrentDraftVersionId = source.CurrentDraftVersionId is Guid draftId
                ? ids.QuizVersions[draftId] : null;
            target.CurrentPublishedVersionId = source.CurrentPublishedVersionId is Guid publishedId
                ? ids.QuizVersions[publishedId] : null;
        }
    }

    private void AddImportAudit(ValidatedImport import, DateTime now) =>
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = import.TenantId,
            ActorUserId = import.ActorUserId,
            Action = "TenantContentImported",
            EntityType = "Tenant",
            EntityId = import.TenantId.ToString(),
            MetadataJson = JsonSerializer.Serialize(BuildCounts(
                import.Questions, import.Quizzes, import.Surveys, import.Templates)),
            RequestId = import.RequestId,
            CreatedAt = now
        });

    private async Task DeleteUploadedObjectsAsync(IEnumerable<string> objectKeys)
    {
        foreach (var objectKey in objectKeys)
        {
            try
            {
                await _storage.DeleteAsync(objectKey, CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Could not delete compensated import object {ObjectKey}.", objectKey);
            }
        }
    }

    private sealed record ValidatedImport(
        Guid TenantId,
        Guid ActorUserId,
        string? RequestId,
        IReadOnlyDictionary<string, ZipArchiveEntry> Entries,
        TenantQuestionsExport Questions,
        TenantQuizzesExport Quizzes,
        TenantSurveysExport Surveys,
        IReadOnlyList<ExportCertificateTemplate> Templates,
        IReadOnlyDictionary<Guid, MediaFileValidator.ValidationOutcome> MediaValidation);

    private sealed record ExportMediaSource(ExportMediaAsset Asset, string ObjectKey);

    private sealed record ExportContent(
        TenantQuestionsExport Questions,
        TenantQuizzesExport Quizzes,
        TenantSurveysExport Surveys,
        IReadOnlyList<ExportCertificateTemplate> Templates,
        IReadOnlyDictionary<Guid, string> MediaObjectKeys);

    private sealed record ImportBuildContext(
        ValidatedImport Import,
        ImportIdMap Ids,
        DateTime Now);

    private sealed class ImportIdMap
    {
        public ImportIdMap(ValidatedImport import)
        {
            Banks = NewIds(import.Questions.Banks.Select(entity => entity.Id));
            Media = NewIds(import.Questions.Media.Select(entity => entity.Id));
            Questions = NewIds(import.Questions.Questions.Select(entity => entity.Id));
            QuestionVersions = NewIds(import.Questions.Versions.Select(entity => entity.Id));
            Quizzes = NewIds(import.Quizzes.Quizzes.Select(entity => entity.Id));
            QuizVersions = NewIds(import.Quizzes.Versions.Select(entity => entity.Id));
            Surveys = NewIds(import.Surveys.Surveys.Select(entity => entity.Id));
            SurveyQuestions = NewIds(import.Surveys.Questions.Select(entity => entity.Id));
        }

        public Dictionary<Guid, Guid> Banks { get; }
        public Dictionary<Guid, Guid> Media { get; }
        public Dictionary<Guid, Guid> Questions { get; }
        public Dictionary<Guid, Guid> QuestionVersions { get; }
        public Dictionary<Guid, Guid> Tags { get; } = [];
        public Dictionary<Guid, Guid> Quizzes { get; }
        public Dictionary<Guid, Guid> QuizVersions { get; }
        public Dictionary<Guid, Guid> Surveys { get; }
        public Dictionary<Guid, Guid> SurveyQuestions { get; }

        private static Dictionary<Guid, Guid> NewIds(IEnumerable<Guid> sourceIds) =>
            sourceIds.ToDictionary(sourceId => sourceId, _ => Guid.NewGuid());
    }

    private sealed record ImportRoots(
        List<MediaAsset> Media,
        List<QuestionTag> Tags,
        List<QuestionBank> Banks,
        List<Question> Questions,
        Dictionary<Guid, Quiz> Quizzes,
        List<CertificateTemplate> Templates);

    private sealed record ImportContentEntities(
        Dictionary<Guid, QuestionVersion> QuestionVersions,
        List<QuestionOption> QuestionOptions,
        List<QuestionTagLink> TagLinks,
        Dictionary<Guid, QuizVersion> QuizVersions,
        List<QuizVersionItem> QuizItems,
        Dictionary<Guid, Survey> Surveys,
        List<SurveyQuestion> SurveyQuestions,
        List<SurveyOption> SurveyOptions);

    private async Task ValidateLimitsAsync(
        Guid tenantId,
        TenantQuestionsExport questions,
        TenantQuizzesExport quizzes,
        CancellationToken cancellationToken)
    {
        var limits = await _planLimits.GetAsync(tenantId, cancellationToken);
        var existingQuizCount = await _db.Quizzes.CountAsync(cancellationToken);
        if (existingQuizCount + quizzes.Quizzes.Count > limits.MaxQuizzesPerTenant)
        {
            throw new ServiceResultException("QuotaExceeded", "Import would exceed the quiz limit for this plan.");
        }
        var existingPublishedCount = await _db.Quizzes.CountAsync(
            quiz => quiz.Status == QuizStatus.Published, cancellationToken);
        if (existingPublishedCount + quizzes.Quizzes.Count(quiz => quiz.Status == QuizStatus.Published)
            > limits.MaxPublishedQuizzesPerTenant)
        {
            throw new ServiceResultException("QuotaExceeded", "Import would exceed the published quiz limit for this plan.");
        }
        if (quizzes.Items.GroupBy(item => item.QuizVersionId)
            .Any(group => group.Count() > limits.MaxQuestionsPerQuiz))
        {
            throw new ServiceResultException("QuotaExceeded", "An imported quiz exceeds the questions-per-quiz limit.");
        }
        var existingStorage = await _db.MediaAssets.SumAsync(asset => (long?)asset.SizeBytes, cancellationToken) ?? 0;
        if (existingStorage + questions.Media.Sum(asset => asset.SizeBytes) > limits.MaxStorageBytes)
        {
            throw new ServiceResultException("QuotaExceeded", "Import would exceed the storage limit for this plan.");
        }
    }

    private IReadOnlyDictionary<Guid, MediaFileValidator.ValidationOutcome> ValidateMediaEntries(
        IReadOnlyDictionary<string, ZipArchiveEntry> entries,
        IReadOnlyList<ExportMediaAsset> media)
    {
        var declaredPaths = media.Select(asset => asset.ArchivePath).ToHashSet(StringComparer.Ordinal);
        var archivePaths = entries.Keys.Where(path => path.StartsWith("media/", StringComparison.Ordinal))
            .ToHashSet(StringComparer.Ordinal);
        if (!declaredPaths.SetEquals(archivePaths))
        {
            throw new ServiceResultException("InvalidImport", "Media entries do not match questions.json.");
        }

        var result = new Dictionary<Guid, MediaFileValidator.ValidationOutcome>();
        foreach (var asset in media)
        {
            if (!asset.ArchivePath.StartsWith("media/", StringComparison.Ordinal)
                || !entries.TryGetValue(asset.ArchivePath, out var entry)
                || entry.Length != asset.SizeBytes)
            {
                throw new ServiceResultException("InvalidImport", "A media entry is missing or has an invalid size.");
            }

            using var header = entry.Open();
            if (!MediaFileValidator.TryValidate(
                    asset.SizeBytes,
                    asset.MimeType,
                    asset.OriginalFileName,
                    () => header,
                    _storageOptions,
                    out var validation)
                || validation.Outcome is null
                || validation.Outcome.Kind != asset.Kind)
            {
                throw new ServiceResultException("InvalidImport", "An imported media file failed content validation.");
            }
            result[asset.Id] = validation.Outcome;
        }
        return result;
    }

    private static void ValidateReferences(
        TenantQuestionsExport questions,
        TenantQuizzesExport quizzes,
        TenantSurveysExport surveys,
        IReadOnlyList<ExportCertificateTemplate> templates)
    {
        EnsureUniqueIds(questions.Banks.Select(item => item.Id), "question bank");
        EnsureUniqueIds(questions.Media.Select(item => item.Id), "media asset");
        EnsureUniqueIds(questions.Questions.Select(item => item.Id), "question");
        EnsureUniqueIds(questions.Versions.Select(item => item.Id), "question version");
        EnsureUniqueIds(questions.Options.Select(item => item.Id), "question option");
        EnsureUniqueIds(questions.Tags.Select(item => item.Id), "question tag");
        EnsureUniqueIds(quizzes.Quizzes.Select(item => item.Id), "quiz");
        EnsureUniqueIds(quizzes.Versions.Select(item => item.Id), "quiz version");
        EnsureUniqueIds(quizzes.Items.Select(item => item.Id), "quiz item");
        EnsureUniqueIds(surveys.Surveys.Select(item => item.Id), "survey");
        EnsureUniqueIds(surveys.Questions.Select(item => item.Id), "survey question");
        EnsureUniqueIds(surveys.Options.Select(item => item.Id), "survey option");
        EnsureUniqueIds(templates.Select(item => item.Id), "certificate template");
        EnsureUniqueKeys(
            questions.Versions.Select(version => (version.QuestionId, version.VersionNumber)),
            "question version numbers");
        EnsureUniqueKeys(
            questions.Options.Select(option => (option.QuestionVersionId, option.SortOrder)),
            "question option positions");
        EnsureUniqueKeys(
            questions.TagLinks.Select(link => (link.QuestionId, link.TagId)),
            "question tag links");
        EnsureUniqueKeys(
            quizzes.Versions.Select(version => (version.QuizId, version.VersionNumber)),
            "quiz version numbers");
        EnsureUniqueKeys(
            quizzes.Items.Select(item => (item.QuizVersionId, item.SortOrder)),
            "quiz item positions");
        EnsureUniqueKeys(
            quizzes.Items.Select(item => (item.QuizVersionId, item.QuestionVersionId)),
            "quiz question links");
        EnsureUniqueKeys(surveys.Surveys.Select(survey => survey.QuizId), "surveys per quiz");
        EnsureUniqueKeys(
            surveys.Questions.Select(question => (question.SurveyId, question.SortOrder)),
            "survey question positions");
        EnsureUniqueKeys(
            surveys.Options.Select(option => (option.SurveyQuestionId, option.SortOrder)),
            "survey option positions");
        if (questions.Tags.Select(tag => tag.NormalizedName).Distinct(StringComparer.Ordinal).Count()
            != questions.Tags.Count)
        {
            throw new ServiceResultException("InvalidImport", "The archive contains duplicate question tag names.");
        }

        var bankIds = questions.Banks.Select(item => item.Id).ToHashSet();
        var mediaIds = questions.Media.Select(item => item.Id).ToHashSet();
        var questionIds = questions.Questions.Select(item => item.Id).ToHashSet();
        var questionVersions = questions.Versions.ToDictionary(item => item.Id);
        var tagIds = questions.Tags.Select(item => item.Id).ToHashSet();
        if (questions.Questions.Any(item => !bankIds.Contains(item.BankId))
            || questions.Versions.Any(item => !questionIds.Contains(item.QuestionId)
                || item.MediaAssetId is Guid mediaId && !mediaIds.Contains(mediaId))
            || questions.Options.Any(item => !questionVersions.ContainsKey(item.QuestionVersionId))
            || questions.TagLinks.Any(item => !questionIds.Contains(item.QuestionId) || !tagIds.Contains(item.TagId))
            || questions.Questions.Any(item => item.CurrentVersionId is Guid versionId
                && (!questionVersions.TryGetValue(versionId, out var version) || version.QuestionId != item.Id)))
        {
            throw new ServiceResultException("InvalidImport", "Question content contains an invalid reference.");
        }

        var quizIds = quizzes.Quizzes.Select(item => item.Id).ToHashSet();
        var quizVersions = quizzes.Versions.ToDictionary(item => item.Id);
        if (quizzes.Versions.Any(item => !quizIds.Contains(item.QuizId))
            || quizzes.Items.Any(item => !quizVersions.ContainsKey(item.QuizVersionId)
                || !questionVersions.ContainsKey(item.QuestionVersionId))
            || quizzes.Quizzes.Any(item => item.CurrentDraftVersionId is Guid draftId
                && (!quizVersions.TryGetValue(draftId, out var draft) || draft.QuizId != item.Id))
            || quizzes.Quizzes.Any(item => item.CurrentPublishedVersionId is Guid publishedId
                && (!quizVersions.TryGetValue(publishedId, out var published) || published.QuizId != item.Id)))
        {
            throw new ServiceResultException("InvalidImport", "Quiz content contains an invalid reference.");
        }

        var surveyIds = surveys.Surveys.Select(item => item.Id).ToHashSet();
        var surveyQuestionIds = surveys.Questions.Select(item => item.Id).ToHashSet();
        if (surveys.Surveys.Any(item => !quizIds.Contains(item.QuizId))
            || surveys.Questions.Any(item => !surveyIds.Contains(item.SurveyId))
            || surveys.Options.Any(item => !surveyQuestionIds.Contains(item.SurveyQuestionId)))
        {
            throw new ServiceResultException("InvalidImport", "Survey content contains an invalid reference.");
        }

        if (questions.Banks.Any(item => !HasLength(item.Name, 1, 200))
            || questions.Versions.Any(item => !HasLength(item.Prompt, 1, 4000))
            || quizzes.Quizzes.Any(item => !HasLength(item.Title, 1, 200)
                || !System.Text.RegularExpressions.Regex.IsMatch(item.Slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
            || surveys.Surveys.Any(item => !HasLength(item.Title, 1, 200))
            || templates.Any(item => !HasLength(item.Name, 1, 120)))
        {
            throw new ServiceResultException("InvalidImport", "Imported content contains invalid field values.");
        }
    }

    private static bool HasLength(string? value, int min, int max) =>
        value is not null && value.Length >= min && value.Length <= max;

    private static void EnsureUniqueIds(IEnumerable<Guid> ids, string label)
    {
        var values = ids.ToList();
        if (values.Any(id => id == Guid.Empty) || values.Count != values.Distinct().Count())
        {
            throw new ServiceResultException("InvalidImport", $"The archive contains duplicate or empty {label} IDs.");
        }
    }

    private static void EnsureUniqueKeys<T>(IEnumerable<T> keys, string label) where T : notnull
    {
        var values = keys.ToList();
        if (values.Count != values.Distinct().Count())
        {
            throw new ServiceResultException("InvalidImport", $"The archive contains duplicate {label}.");
        }
    }

    private static Dictionary<string, ZipArchiveEntry> ValidateArchiveEntries(ZipArchive archive)
    {
        if (archive.Entries.Count == 0 || archive.Entries.Count > MaxEntries)
        {
            throw new ServiceResultException("InvalidImport", "The archive contains an invalid number of entries.");
        }

        long expandedBytes = 0;
        var entries = new Dictionary<string, ZipArchiveEntry>(StringComparer.Ordinal);
        foreach (var entry in archive.Entries)
        {
            var name = entry.FullName;
            if (string.IsNullOrWhiteSpace(name)
                || name.Contains('\\')
                || name.StartsWith("/", StringComparison.Ordinal)
                || name.Split('/').Any(segment => segment is "" or "." or "..")
                || (!name.StartsWith("media/", StringComparison.Ordinal)
                    && name is not "manifest.json"
                    && name is not "questions.json"
                    && name is not "quizzes.json"
                    && name is not "surveys.json"
                    && name is not "certificate-templates.json"))
            {
                throw new ServiceResultException("InvalidImport", "The archive contains an unsafe or unknown path.");
            }
            if (!entries.TryAdd(name, entry))
            {
                throw new ServiceResultException("InvalidImport", "The archive contains duplicate paths.");
            }
            expandedBytes = checked(expandedBytes + entry.Length);
            if (expandedBytes > MaxExpandedBytes)
            {
                throw new ServiceResultException("FileTooLarge", "The expanded import archive exceeds 500 MB.");
            }
        }
        return entries;
    }

    private static ZipArchive OpenZipArchive(Stream content)
    {
        try
        {
            return new ZipArchive(content, ZipArchiveMode.Read, leaveOpen: true);
        }
        catch (InvalidDataException)
        {
            throw new ServiceResultException("InvalidImport", "The uploaded file is not a valid ZIP archive.");
        }
    }

    private static async Task ValidateChecksumsAsync(
        IReadOnlyDictionary<string, ZipArchiveEntry> entries,
        TenantExportManifest manifest,
        CancellationToken cancellationToken)
    {
        if (manifest.Checksums.Count != entries.Count - 1)
        {
            throw new ServiceResultException("InvalidImport", "The archive checksum manifest is incomplete.");
        }
        foreach (var (name, entry) in entries)
        {
            if (name == "manifest.json") continue;
            if (!manifest.Checksums.TryGetValue(name, out var expected)
                || expected.Length != 64
                || !expected.All(Uri.IsHexDigit))
            {
                throw new ServiceResultException("InvalidImport", "The archive checksum manifest is invalid.");
            }
            string actual;
            try
            {
                await using var content = entry.Open();
                actual = await HashAsync(content, cancellationToken);
            }
            catch (InvalidDataException)
            {
                throw new ServiceResultException("InvalidImport", $"Archive entry '{name}' is corrupt.");
            }
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
            {
                throw new ServiceResultException("InvalidImport", $"Checksum mismatch for '{name}'.");
            }
        }
    }

    private static ZipArchiveEntry RequireEntry(
        IReadOnlyDictionary<string, ZipArchiveEntry> entries,
        string name) =>
        entries.TryGetValue(name, out var entry)
            ? entry
            : throw new ServiceResultException("InvalidImport", $"Required archive entry '{name}' is missing.");

    private static async Task<T> ReadJsonAsync<T>(
        ZipArchiveEntry entry,
        long maxBytes,
        CancellationToken cancellationToken)
    {
        if (entry.Length <= 0 || entry.Length > maxBytes)
        {
            throw new ServiceResultException("InvalidImport", $"JSON entry '{entry.FullName}' has an invalid size.");
        }
        try
        {
            await using var content = entry.Open();
            return await JsonSerializer.DeserializeAsync<T>(content, JsonOptions, cancellationToken)
                ?? throw new ServiceResultException("InvalidImport", $"JSON entry '{entry.FullName}' is empty.");
        }
        catch (Exception exception) when (exception is JsonException or InvalidDataException)
        {
            throw new ServiceResultException("InvalidImport", $"JSON entry '{entry.FullName}' is malformed.");
        }
    }

    private static void ValidateManifestCounts(
        IReadOnlyDictionary<string, int> expected,
        IReadOnlyDictionary<string, int> actual)
    {
        if (expected.Count != actual.Count
            || actual.Any(pair => !expected.TryGetValue(pair.Key, out var value) || value != pair.Value))
        {
            throw new ServiceResultException("InvalidImport", "The archive count manifest does not match its content.");
        }
    }

    private static Dictionary<string, int> BuildCounts(
        TenantQuestionsExport questions,
        TenantQuizzesExport quizzes,
        TenantSurveysExport surveys,
        IReadOnlyCollection<ExportCertificateTemplate> templates) =>
        new(StringComparer.Ordinal)
        {
            ["questionBanks"] = questions.Banks.Count,
            ["mediaAssets"] = questions.Media.Count,
            ["questions"] = questions.Questions.Count,
            ["questionVersions"] = questions.Versions.Count,
            ["questionOptions"] = questions.Options.Count,
            ["questionTags"] = questions.Tags.Count,
            ["quizzes"] = quizzes.Quizzes.Count,
            ["quizVersions"] = quizzes.Versions.Count,
            ["quizItems"] = quizzes.Items.Count,
            ["surveys"] = surveys.Surveys.Count,
            ["surveyQuestions"] = surveys.Questions.Count,
            ["surveyOptions"] = surveys.Options.Count,
            ["certificateTemplates"] = templates.Count
        };

    private static async Task WriteJsonEntryAsync<T>(
        ZipArchive archive,
        string name,
        T payload,
        IDictionary<string, string> checksums,
        CancellationToken cancellationToken)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
        var entry = archive.CreateEntry(name, CompressionLevel.Fastest);
        await using var content = entry.Open();
        await content.WriteAsync(bytes, cancellationToken);
        checksums[name] = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    private static async Task<string> CopyAndHashAsync(
        Stream source,
        Stream target,
        CancellationToken cancellationToken)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            hash.AppendData(buffer, 0, read);
            await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private static async Task<string> HashAsync(Stream source, CancellationToken cancellationToken)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            hash.AppendData(buffer, 0, read);
        }
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private static async Task CopyWithLimitAsync(
        Stream source,
        Stream target,
        long limit,
        CancellationToken cancellationToken)
    {
        var total = 0L;
        var buffer = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            total = checked(total + read);
            if (total > limit)
            {
                throw new ServiceResultException("FileTooLarge", "Import archive exceeds 250 MB.");
            }
            await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
    }

    private static string BuildMediaArchivePath(MediaAsset asset)
    {
        var extension = Path.GetExtension(asset.ObjectKey).ToLowerInvariant();
        if (extension.Length is < 2 or > 8 || !extension.Skip(1).All(char.IsLetterOrDigit))
        {
            extension = string.Empty;
        }
        return $"media/{asset.Id:N}{extension}";
    }

    private static string MakeUniqueSlug(string source, Guid sourceId, ISet<string> used)
    {
        var normalized = source.Trim().ToLowerInvariant();
        if (used.Add(normalized)) return normalized;
        var suffix = $"-imported-{sourceId:N}"[..18];
        var prefix = normalized[..Math.Min(normalized.Length, 120 - suffix.Length)].TrimEnd('-');
        var candidate = prefix + suffix;
        var sequence = 2;
        while (!used.Add(candidate))
        {
            var numberedSuffix = $"{suffix}-{sequence++}";
            prefix = normalized[..Math.Min(normalized.Length, 120 - numberedSuffix.Length)].TrimEnd('-');
            candidate = prefix + numberedSuffix;
        }
        return candidate;
    }

    private static string MakeUniqueName(
        string source,
        Guid sourceId,
        ISet<string> used,
        int maxLength)
    {
        var trimmed = source.Trim();
        if (used.Add(trimmed)) return trimmed;
        var suffix = $" (imported {sourceId:N})"[..20];
        var candidate = trimmed[..Math.Min(trimmed.Length, maxLength - suffix.Length)].TrimEnd() + suffix;
        var sequence = 2;
        while (!used.Add(candidate))
        {
            var numberedSuffix = $"{suffix[..^1]} {sequence++})";
            candidate = trimmed[..Math.Min(trimmed.Length, maxLength - numberedSuffix.Length)].TrimEnd()
                + numberedSuffix;
        }
        return candidate;
    }

    private static string ComputeQuizChecksum(QuizVersion version)
    {
        var content = new StringBuilder()
            .Append(version.TitleSnapshot).Append('|')
            .Append(version.DescriptionSnapshot ?? string.Empty).Append('|')
            .Append(version.InstructionsSnapshot ?? string.Empty).Append('|')
            .Append(version.PassingPercentage).Append('|')
            .Append(version.TimeMode).Append('|')
            .Append(version.TimeLimitSeconds?.ToString() ?? string.Empty).Append('|')
            .Append(version.ShuffleQuestions).Append('|')
            .Append(version.ShuffleOptions).Append('|')
            .Append(version.ThemeJson);
        foreach (var item in version.Items.OrderBy(item => item.SortOrder))
        {
            content.Append('|').Append(item.QuestionVersionId).Append(',')
                .Append(item.SortOrder).Append(',').Append(item.Points).Append(',').Append(item.IsRequired);
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(content.ToString()))).ToLowerInvariant();
    }

    private static string GeneratePublicCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private void EnsureTenant(Guid tenantId)
    {
        if (!_tenantContext.IsResolved || _tenantContext.TenantId != tenantId || tenantId == Guid.Empty)
        {
            throw new ServiceResultException("TenantContextMissing", "Tenant context is not resolved.");
        }
    }
}
