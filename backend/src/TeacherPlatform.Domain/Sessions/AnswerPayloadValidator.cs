using System.Text.Json;
using TeacherPlatform.Domain.Questions;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// فحص بنيوي صارم لحمولة إجابة قبل أي حفظ/تسجيل — 400 InvalidAnswerPayload.
///
/// يتحقق فقط من البنية والانتماء (وليس الصواب): الخيارات المُشار إليها يجب أن
/// تنتمي لنسخة السؤال المثبتة فعليًا. التقييم يبقى في AnswerScorer كدفاع أخير
/// لا يرمي استثناء (صفر لغير الصالح).
///
/// القواعد:
/// - MultipleChoice / TrueFalse / Listening: {"optionId": guid} — يجب أن يكون
///   الخيار المحدد خيارًا فعليًا من نسخة السؤال.
/// - ShortAnswer: {"text": نص غير فارغ} فقط.
/// - Ordering: {"orderedOptionIds": [guids]} — كامل (كل خيار مرة واحدة بالضبط)،
///   بلا تكرار، بلا أجنبي، بلا نقص.
/// </summary>
public static class AnswerPayloadValidator
{
    /// <summary>التحقق من حمولة إجابة. عند الرفض يعيد invalidReason توضيحيًا (لا يُكشف للعميل).</summary>
    public static bool TryValidate(
        QuestionType type,
        IReadOnlyList<QuestionOption> options,
        string answerJson,
        out string invalidReason)
    {
        invalidReason = string.Empty;

        if (string.IsNullOrWhiteSpace(answerJson))
        {
            invalidReason = "Answer payload is empty.";
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(answerJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                invalidReason = "Answer payload must be a JSON object.";
                return false;
            }

            return type switch
            {
                QuestionType.MultipleChoice or QuestionType.TrueFalse or QuestionType.Listening
                    => ValidateChoice(root, options, out invalidReason),
                QuestionType.ShortAnswer => ValidateShortAnswer(root, out invalidReason),
                QuestionType.Ordering => ValidateOrdering(root, options, out invalidReason),
                _ => Reject("Unsupported question type.", out invalidReason),
            };
        }
        catch (JsonException)
        {
            invalidReason = "Answer payload is not valid JSON.";
            return false;
        }
    }

    // ---------- MultipleChoice / TrueFalse / Listening ----------

    private static bool ValidateChoice(
        JsonElement root,
        IReadOnlyList<QuestionOption> options,
        out string invalidReason)
    {
        if (!root.TryGetProperty("optionId", out var optionIdEl))
        {
            return Reject("Missing 'optionId'.", out invalidReason);
        }

        if (optionIdEl.ValueKind != JsonValueKind.String
            || !Guid.TryParse(optionIdEl.GetString(), out var selectedId))
        {
            return Reject("'optionId' must be a string GUID.", out invalidReason);
        }

        if (!options.Any(o => o.Id == selectedId))
        {
            return Reject("'optionId' does not belong to this question.", out invalidReason);
        }

        invalidReason = string.Empty;
        return true;
    }

    // ---------- ShortAnswer ----------

    private static bool ValidateShortAnswer(JsonElement root, out string invalidReason)
    {
        if (!root.TryGetProperty("text", out var textEl))
        {
            return Reject("Missing 'text'.", out invalidReason);
        }

        if (textEl.ValueKind != JsonValueKind.String)
        {
            return Reject("'text' must be a string.", out invalidReason);
        }

        if (string.IsNullOrWhiteSpace(textEl.GetString()))
        {
            return Reject("'text' must not be empty.", out invalidReason);
        }

        invalidReason = string.Empty;
        return true;
    }

    // ---------- Ordering ----------

    private static bool ValidateOrdering(
        JsonElement root,
        IReadOnlyList<QuestionOption> options,
        out string invalidReason)
    {
        if (!root.TryGetProperty("orderedOptionIds", out var orderedEl))
        {
            return Reject("Missing 'orderedOptionIds'.", out invalidReason);
        }

        if (orderedEl.ValueKind != JsonValueKind.Array)
        {
            return Reject("'orderedOptionIds' must be an array.", out invalidReason);
        }

        var expected = options.Select(o => o.Id).ToHashSet();
        var submitted = new HashSet<Guid>();
        foreach (var item in orderedEl.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String
                || !Guid.TryParse(item.GetString(), out var id))
            {
                return Reject("Each ordering item must be a string GUID.", out invalidReason);
            }

            if (!expected.Contains(id))
            {
                return Reject("Ordering contains an id that does not belong to this question.", out invalidReason);
            }

            if (!submitted.Add(id))
            {
                return Reject("Ordering contains duplicate ids.", out invalidReason);
            }
        }

        if (submitted.Count != expected.Count)
        {
            return Reject("Ordering must include every option exactly once.", out invalidReason);
        }

        invalidReason = string.Empty;
        return true;
    }

    private static bool Reject(string reason, out string invalidReason)
    {
        invalidReason = reason;
        return false;
    }
}
