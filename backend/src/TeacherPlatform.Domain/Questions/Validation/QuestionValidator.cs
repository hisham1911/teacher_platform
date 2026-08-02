using System.Text.Json;

namespace TeacherPlatform.Domain.Questions.Validation;

/// <summary>وصف اختيار واحد عند التحقق من صلاحية سؤال.</summary>
public sealed record OptionSpec(string Text, bool IsCorrect);

/// <summary>نتيجة التحقق: أخطاء قابلة للعرض على المعلم بدون كشف داخلي زائد.</summary>
public sealed class QuestionValidationResult
{
    public bool IsValid => Errors.Count == 0;

    public List<string> Errors { get; } = new();

    public static QuestionValidationResult Valid() => new();

    public static QuestionValidationResult Invalid(params string[] errors)
    {
        var result = new QuestionValidationResult();
        result.Errors.AddRange(errors);
        return result;
    }
}

/// <summary>
/// خدمة تحقق المجال من صلاحية أسئلة الأنواع الخمسة. خالصة بلا I/O —
/// تُستخدم من Application عند الإنشاء/التعديل، ويستطيع Phase 3 استخدامها
/// لمعرفة هل السؤال صالح للنشر قبل تثبيت الاختبار.
/// </summary>
public static class QuestionValidator
{
    public const int MaxPromptLength = 2000;
    public const int MaxExplanationLength = 2000;
    public const int MaxOptionTextLength = 500;
    public const int MinOptions = 2;
    public const int MaxOptions = 10;
    public const int MaxAcceptedAnswers = 20;
    public const int MaxAcceptedAnswerLength = 200;

    public static QuestionValidationResult ValidateContent(
        string prompt,
        string? explanation,
        string language)
    {
        var result = new QuestionValidationResult();

        if (string.IsNullOrWhiteSpace(prompt))
        {
            result.Errors.Add("PromptRequired");
        }
        else if (prompt.Trim().Length > MaxPromptLength)
        {
            result.Errors.Add("PromptTooLong");
        }

        if (explanation is not null && explanation.Length > MaxExplanationLength)
        {
            result.Errors.Add("ExplanationTooLong");
        }

        if (language is not ("ar" or "en"))
        {
            result.Errors.Add("UnsupportedLanguage");
        }

        return result;
    }

    /// <summary>
    /// يتحقق من صلاحية سؤال كامل حسب نوعه وخياراته. hasMedia مطلوب لأسئلة الاستماع.
    /// </summary>
    public static QuestionValidationResult ValidateForVersion(
        QuestionType type,
        string prompt,
        string? explanation,
        string language,
        string configJson,
        IReadOnlyList<OptionSpec> options,
        bool hasMedia)
    {
        var result = ValidateContent(prompt, explanation, language);

        switch (type)
        {
            case QuestionType.MultipleChoice:
                ValidateChoiceOptions(result, options, requireExactlyOneCorrect: true);

                if (hasMedia)
                {
                    // الصورة مسموحة؛ يتحقق نوع الوسائط فعليًا في طبقة Application
                }
                break;

            case QuestionType.TrueFalse:
                if (options.Count != 2)
                {
                    result.Errors.Add("TrueFalseRequiresTwoOptions");
                }

                ValidateChoiceOptions(result, options, requireExactlyOneCorrect: true);
                break;

            case QuestionType.ShortAnswer:
                if (options.Count != 0)
                {
                    result.Errors.Add("ShortAnswerHasNoOptions");
                }

                var accepted = ParseAcceptedAnswers(configJson);
                if (accepted is null)
                {
                    result.Errors.Add("InvalidConfigJson");
                }
                else if (accepted.Count == 0)
                {
                    result.Errors.Add("AcceptedAnswerRequired");
                }
                else
                {
                    if (accepted.Count > MaxAcceptedAnswers)
                    {
                        result.Errors.Add("TooManyAcceptedAnswers");
                    }

                    if (accepted.Any(a => string.IsNullOrWhiteSpace(a) || a.Trim().Length > MaxAcceptedAnswerLength))
                    {
                        result.Errors.Add("AcceptedAnswerInvalid");
                    }
                }
                break;

            case QuestionType.Ordering:
                if (options.Count < 2 || options.Count > MaxOptions)
                {
                    result.Errors.Add("OrderingRequiresTwoToTenItems");
                }

                if (options.Any(o => string.IsNullOrWhiteSpace(o.Text)))
                {
                    result.Errors.Add("OptionTextRequired");
                }

                if (options.Any(o => o.Text.Trim().Length > MaxOptionTextLength))
                {
                    result.Errors.Add("OptionTextTooLong");
                }
                break;

            case QuestionType.Listening:
                if (!hasMedia)
                {
                    result.Errors.Add("ListeningRequiresAudio");
                }

                ValidateChoiceOptions(result, options, requireExactlyOneCorrect: true);
                break;

            default:
                result.Errors.Add("UnknownQuestionType");
                break;
        }

        // JSON يجب أن يكون صالحًا دائمًا (IsPersisted لاحقًا)
        if (!IsValidJsonObject(configJson))
        {
            result.Errors.Add("InvalidConfigJson");
        }

        return result;
    }

    private static void ValidateChoiceOptions(
        QuestionValidationResult result,
        IReadOnlyList<OptionSpec> options,
        bool requireExactlyOneCorrect)
    {
        if (options.Count < MinOptions || options.Count > MaxOptions)
        {
            result.Errors.Add("OptionsCountInvalid");
        }

        if (options.Any(o => string.IsNullOrWhiteSpace(o.Text)))
        {
            result.Errors.Add("OptionTextRequired");
        }

        if (options.Any(o => o.Text.Trim().Length > MaxOptionTextLength))
        {
            result.Errors.Add("OptionTextTooLong");
        }

        if (requireExactlyOneCorrect && options.Count(o => o.IsCorrect) != 1)
        {
            result.Errors.Add("ExactlyOneCorrectOptionRequired");
        }
    }

    /// <summary>يقرأ الإجابات المقبولة لسؤال الإجابة القصيرة من ConfigJson.</summary>
    public static IReadOnlyList<string>? ParseAcceptedAnswers(string configJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(configJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("acceptedAnswers", out var answers)
                || answers.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var list = new List<string>();
            foreach (var item in answers.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String)
                {
                    return null;
                }

                list.Add(item.GetString() ?? string.Empty);
            }

            return list;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>يبني ConfigJson قياسي لسؤال إجابة قصيرة.</summary>
    public static string BuildShortAnswerConfig(IReadOnlyList<string> acceptedAnswers)
    {
        var payload = new { acceptedAnswers = acceptedAnswers.Select(a => a.Trim()).ToArray() };
        return JsonSerializer.Serialize(payload);
    }

    private static bool IsValidJsonObject(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
