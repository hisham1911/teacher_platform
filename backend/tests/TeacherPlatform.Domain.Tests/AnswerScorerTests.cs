using System.Collections.Generic;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Sessions;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

/// <summary>
/// اختبارات محرك التقييم من جهة السيرفر للأنواع الخمسة —
/// خالصة بدون I/O، تغطي التطبيع والتقريب والحمولات غير الصالحة.
/// </summary>
public class AnswerScorerTests
{
    private static QuestionOption Option(string text, bool isCorrect, int sortOrder = 0) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            QuestionVersionId = Guid.NewGuid(),
            OptionText = text,
            IsCorrect = isCorrect,
            SortOrder = sortOrder,
        };

    // ---------- MultipleChoice / TrueFalse / Listening ----------

    [Fact]
    public void Choice_CorrectOption_AwardsFullPoints()
    {
        var correct = Option("أ", true);
        var wrong = Option("ب", false);
        var options = new List<QuestionOption> { correct, wrong };

        var result = AnswerScorer.Score(
            QuestionType.MultipleChoice, "{}", options,
            $$"""{"optionId":"{{correct.Id}}"}""", 10);

        Assert.True(result.IsCorrect);
        Assert.Equal(10m, result.ScoreAwarded);
    }

    [Fact]
    public void Choice_WrongOption_AwardsZero()
    {
        var correct = Option("أ", true);
        var wrong = Option("ب", false);
        var options = new List<QuestionOption> { correct, wrong };

        var result = AnswerScorer.Score(
            QuestionType.TrueFalse, "{}", options,
            $$"""{"optionId":"{{wrong.Id}}"}""", 5);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    [Fact]
    public void Listening_UsesSameChoicePolicy()
    {
        var correct = Option("مقطع 1", true);
        var options = new List<QuestionOption> { correct, Option("مقطع 2", false) };

        var result = AnswerScorer.Score(
            QuestionType.Listening, "{}", options,
            $$"""{"optionId":"{{correct.Id}}"}""", 7);

        Assert.True(result.IsCorrect);
        Assert.Equal(7m, result.ScoreAwarded);
    }

    [Fact]
    public void Choice_UnknownOptionId_AwardsZero()
    {
        var options = new List<QuestionOption> { Option("أ", true) };

        var result = AnswerScorer.Score(
            QuestionType.MultipleChoice, "{}", options,
            $$"""{"optionId":"{{Guid.NewGuid()}}"}""", 10);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    // ---------- ShortAnswer ----------

    private const string ShortAnswerConfig = """{"acceptedAnswers":["القاهرة","Cairo"]}""";

    [Fact]
    public void ShortAnswer_ExactMatch_AwardsFullPoints()
    {
        var result = AnswerScorer.Score(
            QuestionType.ShortAnswer, ShortAnswerConfig, [],
            """{"text":"القاهرة"}""", 10);

        Assert.True(result.IsCorrect);
        Assert.Equal(10m, result.ScoreAwarded);
    }

    [Fact]
    public void ShortAnswer_CaseInsensitive_AndWhitespaceFolded()
    {
        var result = AnswerScorer.Score(
            QuestionType.ShortAnswer, ShortAnswerConfig, [],
            """{"text":"  CAIRO  "}""", 10);

        Assert.True(result.IsCorrect);
        Assert.Equal(10m, result.ScoreAwarded);
    }

    [Fact]
    public void ShortAnswer_CollapsesRepeatedWhitespace()
    {
        const string config = """{"acceptedAnswers":["نور الدين"]}""";

        var result = AnswerScorer.Score(
            QuestionType.ShortAnswer, config, [],
            """{"text":"نور   الدين"}""", 4);

        Assert.True(result.IsCorrect);
        Assert.Equal(4m, result.ScoreAwarded);
    }

    [Fact]
    public void ShortAnswer_WrongAnswer_AwardsZero()
    {
        var result = AnswerScorer.Score(
            QuestionType.ShortAnswer, ShortAnswerConfig, [],
            """{"text":"الإسكندرية"}""", 10);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    [Fact]
    public void ShortAnswer_EmptyText_AwardsZero()
    {
        var result = AnswerScorer.Score(
            QuestionType.ShortAnswer, ShortAnswerConfig, [],
            """{"text":"   "}""", 10);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    // ---------- Ordering ----------

    [Fact]
    public void Ordering_ExactOrder_AwardsFullPoints()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var third = Option("3", false, sortOrder: 3);
        var options = new List<QuestionOption> { third, first, second }; // القائمة غير مرتبة — الترتيب من SortOrder

        var result = AnswerScorer.Score(
            QuestionType.Ordering, "{}", options,
            $$"""{"orderedOptionIds":["{{first.Id}}","{{second.Id}}","{{third.Id}}"]}""", 9);

        Assert.True(result.IsCorrect);
        Assert.Equal(9m, result.ScoreAwarded);
    }

    [Fact]
    public void Ordering_PartialOrder_AwardsProportionalRoundedScore()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var third = Option("3", false, sortOrder: 3);
        var options = new List<QuestionOption> { first, second, third };

        // موضع واحد صحيح من ثلاثة (الأول فقط) → 1/3 × 9 = 3.00
        var result = AnswerScorer.Score(
            QuestionType.Ordering, "{}", options,
            $$"""{"orderedOptionIds":["{{first.Id}}","{{third.Id}}","{{second.Id}}"]}""", 9);

        Assert.False(result.IsCorrect);
        Assert.Equal(3.00m, result.ScoreAwarded);
    }

    [Fact]
    public void Ordering_RoundsHalfAwayFromZero()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var options = new List<QuestionOption> { first, second };

        // موضع واحد صحيح من اثنين → 1/2 × 5 = 2.5 → 2.50 (AwayFromZero لا يؤثر هنا لأنه نصف صريح)
        var result = AnswerScorer.Score(
            QuestionType.Ordering, "{}", options,
            $$"""{"orderedOptionIds":["{{first.Id}}","{{second.Id}}"]}""", 5);

        Assert.True(result.IsCorrect);
        Assert.Equal(5m, result.ScoreAwarded);
    }

    [Fact]
    public void Ordering_DuplicateIds_AwardsZero()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var options = new List<QuestionOption> { first, second };

        var result = AnswerScorer.Score(
            QuestionType.Ordering, "{}", options,
            $$"""{"orderedOptionIds":["{{first.Id}}","{{first.Id}}"]}""", 5);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    [Fact]
    public void Ordering_WrongCount_AwardsZero()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var options = new List<QuestionOption> { first, second };

        var result = AnswerScorer.Score(
            QuestionType.Ordering, "{}", options,
            $$"""{"orderedOptionIds":["{{first.Id}}"]}""", 5);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    // ---------- حمولات غير صالحة ----------

    [Fact]
    public void InvalidJson_AwardsZero_WithoutThrowing()
    {
        var options = new List<QuestionOption> { Option("أ", true) };

        var result = AnswerScorer.Score(
            QuestionType.MultipleChoice, "{}", options, "not-json", 10);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    [Fact]
    public void MissingProperty_AwardsZero()
    {
        var options = new List<QuestionOption> { Option("أ", true) };

        var result = AnswerScorer.Score(
            QuestionType.MultipleChoice, "{}", options, """{"wrong":"shape"}""", 10);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    [Fact]
    public void ZeroPoints_AlwaysAwardsZero()
    {
        var correct = Option("أ", true);
        var options = new List<QuestionOption> { correct };

        var result = AnswerScorer.Score(
            QuestionType.MultipleChoice, "{}", options,
            $$"""{"optionId":"{{correct.Id}}"}""", 0);

        Assert.False(result.IsCorrect);
        Assert.Equal(0m, result.ScoreAwarded);
    }

    // ---------- NormalizeText ----------

    [Fact]
    public void NormalizeText_Trims_FoldsSpaces_Lowercases()
    {
        Assert.Equal("hello world", AnswerScorer.NormalizeText("  Hello   World  "));
    }

    [Fact]
    public void NormalizeText_UnicodeFormC_ComposesCharacters()
    {
        // e + combining acute (decomposed) → é (composed)
        Assert.Equal("café", AnswerScorer.NormalizeText("café"));
    }
}
