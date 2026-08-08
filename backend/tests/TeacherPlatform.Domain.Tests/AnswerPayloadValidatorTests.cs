using System.Collections.Generic;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Sessions;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

/// <summary>
/// اختبارات الفحص البنيوي الصارم لحمولة الإجابة — يرفض الحمولات غير الصالحة
/// قبل أي حفظ. لا يقيم الصواب (ذاك اختصاص AnswerScorer).
/// </summary>
public class AnswerPayloadValidatorTests
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

    private static bool Valid(
        QuestionType type,
        IReadOnlyList<QuestionOption> options,
        string answerJson) =>
        AnswerPayloadValidator.TryValidate(type, options, answerJson, out _);

    // ---------- MultipleChoice / TrueFalse / Listening ----------

    [Fact]
    public void Choice_ValidOptionFromQuestion_Passes()
    {
        var correct = Option("أ", true);
        var wrong = Option("ب", false);
        var options = new List<QuestionOption> { correct, wrong };

        Assert.True(Valid(QuestionType.MultipleChoice, options, $$"""{"optionId":"{{correct.Id}}"}"""));
        Assert.True(Valid(QuestionType.TrueFalse, options, $$"""{"optionId":"{{wrong.Id}}"}"""));
        Assert.True(Valid(QuestionType.Listening, options, $$"""{"optionId":"{{wrong.Id}}"}"""));
    }

    [Fact]
    public void Choice_ForeignOptionId_IsRejected()
    {
        var options = new List<QuestionOption> { Option("أ", true) };
        Assert.False(Valid(QuestionType.MultipleChoice, options, $$"""{"optionId":"{{Guid.NewGuid()}}"}"""));
    }

    [Fact]
    public void Choice_MissingOptionId_IsRejected()
    {
        var options = new List<QuestionOption> { Option("أ", true) };
        Assert.False(Valid(QuestionType.TrueFalse, options, """{"text":"إجابة"}"""));
        Assert.False(Valid(QuestionType.TrueFalse, options, """{}"""));
    }

    [Fact]
    public void Choice_NonGuidOptionId_IsRejected()
    {
        var options = new List<QuestionOption> { Option("أ", true) };
        Assert.False(Valid(QuestionType.Listening, options, """{"optionId":"not-a-guid"}"""));
        Assert.False(Valid(QuestionType.Listening, options, """{"optionId":123}"""));
    }

    [Fact]
    public void Choice_NonObjectPayload_IsRejected()
    {
        var options = new List<QuestionOption> { Option("أ", true) };
        Assert.False(Valid(QuestionType.MultipleChoice, options, """[]"""));
        Assert.False(Valid(QuestionType.MultipleChoice, options, "not-json"));
        Assert.False(Valid(QuestionType.MultipleChoice, options, string.Empty));
    }

    // ---------- ShortAnswer ----------

    [Fact]
    public void ShortAnswer_NonEmptyText_Passes()
    {
        Assert.True(Valid(QuestionType.ShortAnswer, [], """{"text":"القاهرة"}"""));
    }

    [Fact]
    public void ShortAnswer_WrongStructure_IsRejected()
    {
        Assert.False(Valid(QuestionType.ShortAnswer, [], """{"optionId":"00000000-0000-0000-0000-000000000000"}"""));
        Assert.False(Valid(QuestionType.ShortAnswer, [], """{"text":123}"""));
        Assert.False(Valid(QuestionType.ShortAnswer, [], """{"text":""}"""));
        Assert.False(Valid(QuestionType.ShortAnswer, [], """{}"""));
    }

    // ---------- Ordering ----------

    private static List<QuestionOption> ThreeOptions()
    {
        var first = Option("1", false, sortOrder: 1);
        var second = Option("2", false, sortOrder: 2);
        var third = Option("3", false, sortOrder: 3);
        return new List<QuestionOption> { first, second, third };
    }

    [Fact]
    public void Ordering_CompleteUniqueSet_Passes()
    {
        var options = ThreeOptions();
        Assert.True(Valid(QuestionType.Ordering, options,
            $$"""{"orderedOptionIds":["{{options[0].Id}}","{{options[1].Id}}","{{options[2].Id}}"]}"""));
    }

    [Fact]
    public void Ordering_MissingOne_IsRejected()
    {
        var options = ThreeOptions();
        Assert.False(Valid(QuestionType.Ordering, options,
            $$"""{"orderedOptionIds":["{{options[0].Id}}","{{options[1].Id}}"]}"""));
    }

    [Fact]
    public void Ordering_DuplicateId_IsRejected()
    {
        var options = ThreeOptions();
        Assert.False(Valid(QuestionType.Ordering, options,
            $$"""{"orderedOptionIds":["{{options[0].Id}}","{{options[0].Id}}","{{options[1].Id}}"]}"""));
    }

    [Fact]
    public void Ordering_ForeignId_IsRejected()
    {
        var options = ThreeOptions();
        Assert.False(Valid(QuestionType.Ordering, options,
            $$"""{"orderedOptionIds":["{{options[0].Id}}","{{options[1].Id}}","{{Guid.NewGuid()}}"]}"""));
    }

    [Fact]
    public void Ordering_WrongShape_IsRejected()
    {
        var options = ThreeOptions();
        Assert.False(Valid(QuestionType.Ordering, options, """{"orderedOptionIds":"not-an-array"}"""));
        Assert.False(Valid(QuestionType.Ordering, options, """{"orderedOptionIds":["x", 1, "y"]}"""));
        Assert.False(Valid(QuestionType.Ordering, options, """{}"""));
    }
}
