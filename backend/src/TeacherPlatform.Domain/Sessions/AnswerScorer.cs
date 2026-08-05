using System.Globalization;
using System.Text;
using System.Text.Json;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Questions.Validation;

namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// نتيجة تقييم إجابة واحدة — IsCorrect للعرض، ScoreAwarded بين 0 وPoints.
/// </summary>
public sealed record ScoringResult(bool IsCorrect, decimal ScoreAwarded);

/// <summary>
/// محرك التقييم من جهة السيرفر للأنواع الخمسة. خالص بلا I/O — قابل لاختبار الوحدة.
///
/// سياسات التقييم الموثقة:
/// - MultipleChoice / TrueFalse / Listening: كل شيء أو لا شيء — الخيار المحدد يطابق الخيار الصحيح.
/// - ShortAnswer: تطبيع Unicode (FormC) + Trim + طيّ المسافات المتتالية + مقارنة غير حساسة لحالة الأحرف
///   ضد الإجابات المقبولة في ConfigJson (acceptedAnswers).
/// - Ordering: ترتيب مطابق تمامًا = الدرجة الكاملة؛ وإلا درجة جزئية = (عدد المواضع الصحيحة / الإجمالي) × Points،
///   مقربة إلى منزلتين عشريتين بـ MidpointRounding.AwayFromZero.
/// - أي حمولة JSON غير صالحة أو ناقصة = صفر (لا استثناءات للاعب).
/// </summary>
public static class AnswerScorer
{
    /// <summary>
    /// يقيّم إجابة واحدة. options هي خيارات نسخة السؤال المثبتة (مع IsCorrect).
    /// </summary>
    public static ScoringResult Score(
        QuestionType type,
        string configJson,
        IReadOnlyList<QuestionOption> options,
        string answerJson,
        int points)
    {
        if (points <= 0)
        {
            return new ScoringResult(false, 0m);
        }

        try
        {
            using var doc = JsonDocument.Parse(answerJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Zero();
            }

            return type switch
            {
                QuestionType.MultipleChoice or QuestionType.TrueFalse or QuestionType.Listening
                    => ScoreChoice(root, options, points),
                QuestionType.ShortAnswer
                    => ScoreShortAnswer(root, configJson, points),
                QuestionType.Ordering
                    => ScoreOrdering(root, options, points),
                _ => Zero(),
            };
        }
        catch (JsonException)
        {
            return Zero();
        }
    }

    private static ScoringResult Zero() => new(false, 0m);

    // ---------- MultipleChoice / TrueFalse / Listening ----------

    private static ScoringResult ScoreChoice(
        JsonElement root,
        IReadOnlyList<QuestionOption> options,
        int points)
    {
        if (!root.TryGetProperty("optionId", out var optionIdEl)
            || optionIdEl.ValueKind != JsonValueKind.String
            || !Guid.TryParse(optionIdEl.GetString(), out var selectedId))
        {
            return Zero();
        }

        var correct = options.FirstOrDefault(o => o.IsCorrect);
        if (correct is null)
        {
            return Zero();
        }

        var isCorrect = correct.Id == selectedId;
        return new ScoringResult(isCorrect, isCorrect ? points : 0m);
    }

    // ---------- ShortAnswer ----------

    private static ScoringResult ScoreShortAnswer(
        JsonElement root,
        string configJson,
        int points)
    {
        if (!root.TryGetProperty("text", out var textEl) || textEl.ValueKind != JsonValueKind.String)
        {
            return Zero();
        }

        var accepted = QuestionValidator.ParseAcceptedAnswers(configJson);
        if (accepted is null || accepted.Count == 0)
        {
            return Zero();
        }

        var normalized = NormalizeText(textEl.GetString() ?? string.Empty);
        if (normalized.Length == 0)
        {
            return Zero();
        }

        var isCorrect = accepted.Any(a => string.Equals(NormalizeText(a), normalized, StringComparison.Ordinal));
        return new ScoringResult(isCorrect, isCorrect ? points : 0m);
    }

    /// <summary>
    /// تطبيع النص: Unicode FormC + Trim + طيّ المسافات المتتالية إلى مسافة واحدة + ToLowerInvariant.
    /// </summary>
    public static string NormalizeText(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormC).Trim();
        var builder = new StringBuilder(normalized.Length);
        var previousWasSpace = false;
        foreach (var ch in normalized)
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!previousWasSpace)
                {
                    builder.Append(' ');
                }

                previousWasSpace = true;
            }
            else
            {
                builder.Append(ch);
                previousWasSpace = false;
            }
        }

        return builder.ToString().ToLower(CultureInfo.InvariantCulture);
    }

    // ---------- Ordering ----------

    private static ScoringResult ScoreOrdering(
        JsonElement root,
        IReadOnlyList<QuestionOption> options,
        int points)
    {
        if (!root.TryGetProperty("orderedOptionIds", out var orderedEl)
            || orderedEl.ValueKind != JsonValueKind.Array)
        {
            return Zero();
        }

        var submitted = new List<Guid>();
        foreach (var item in orderedEl.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String
                || !Guid.TryParse(item.GetString(), out var id))
            {
                return Zero();
            }

            submitted.Add(id);
        }

        // الترتيب الصحيح = ترتيب SortOrder التصاعدي في نسخة السؤال المثبتة
        var correctOrder = options.OrderBy(o => o.SortOrder).Select(o => o.Id).ToList();
        if (submitted.Count != correctOrder.Count || submitted.Distinct().Count() != correctOrder.Count)
        {
            return Zero();
        }

        var correctPositions = 0;
        for (var i = 0; i < correctOrder.Count; i++)
        {
            if (submitted[i] == correctOrder[i])
            {
                correctPositions++;
            }
        }

        if (correctPositions == correctOrder.Count)
        {
            return new ScoringResult(true, points);
        }

        var raw = (decimal)correctPositions / correctOrder.Count * points;
        var rounded = Math.Round(raw, 2, MidpointRounding.AwayFromZero);
        return new ScoringResult(false, rounded);
    }
}
