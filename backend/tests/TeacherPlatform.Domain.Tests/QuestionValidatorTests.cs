using System.Collections.Generic;
using TeacherPlatform.Domain.Questions;
using TeacherPlatform.Domain.Questions.Validation;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

/// <summary>اختبارات تحقق المجال لكل نوع سؤال — خالصة بدون I/O.</summary>
public class QuestionValidatorTests
{
    private static readonly IReadOnlyList<OptionSpec> TwoOptionsOneCorrect =
    [
        new OptionSpec("A", true),
        new OptionSpec("B", false),
    ];

    [Fact]
    public void MultipleChoice_WithExactlyOneCorrect_IsValid()
    {
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice,
            "ما ناتج 2+2؟",
            null,
            "ar",
            "{}",
            TwoOptionsOneCorrect,
            hasMedia: false);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void MultipleChoice_WithNoCorrect_Fails()
    {
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice,
            "prompt",
            null,
            "ar",
            "{}",
            [new OptionSpec("A", false), new OptionSpec("B", false)],
            hasMedia: false);

        Assert.False(result.IsValid);
        Assert.Contains("ExactlyOneCorrectOptionRequired", result.Errors);
    }

    [Fact]
    public void MultipleChoice_WithTwoCorrect_Fails()
    {
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice,
            "prompt",
            null,
            "ar",
            "{}",
            [new OptionSpec("A", true), new OptionSpec("B", true)],
            hasMedia: false);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void MultipleChoice_WithOneOption_Fails()
    {
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice,
            "prompt",
            null,
            "ar",
            "{}",
            [new OptionSpec("Only", true)],
            hasMedia: false);

        Assert.False(result.IsValid);
        Assert.Contains("OptionsCountInvalid", result.Errors);
    }

    [Fact]
    public void TrueFalse_RequiresExactlyTwoOptions_OneCorrect()
    {
        var valid = QuestionValidator.ValidateForVersion(
            QuestionType.TrueFalse,
            "السماء زرقاء",
            null,
            "ar",
            "{}",
            [new OptionSpec("صح", true), new OptionSpec("خطأ", false)],
            hasMedia: false);
        Assert.True(valid.IsValid);

        var threeOptions = QuestionValidator.ValidateForVersion(
            QuestionType.TrueFalse,
            "prompt",
            null,
            "ar",
            "{}",
            [new OptionSpec("A", true), new OptionSpec("B", false), new OptionSpec("C", false)],
            hasMedia: false);
        Assert.False(threeOptions.IsValid);
    }

    [Fact]
    public void ShortAnswer_RequiresAcceptedAnswers_NoOptions()
    {
        var emptyAnswers = QuestionValidator.ValidateForVersion(
            QuestionType.ShortAnswer,
            "أكمل فراغ: السماء ___",
            null,
            "ar",
            "{}",
            [],
            hasMedia: false);
        Assert.False(emptyAnswers.IsValid);

        var config = QuestionValidator.BuildShortAnswerConfig(["blue", "زرقاء"]);
        var valid = QuestionValidator.ValidateForVersion(
            QuestionType.ShortAnswer,
            "أكمل فراغ: السماء ___",
            null,
            "ar",
            config,
            [],
            hasMedia: false);
        Assert.True(valid.IsValid);
    }

    [Fact]
    public void ShortAnswer_WithOptions_Fails()
    {
        var config = QuestionValidator.BuildShortAnswerConfig(["answer"]);
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.ShortAnswer,
            "prompt",
            null,
            "ar",
            config,
            TwoOptionsOneCorrect,
            hasMedia: false);
        Assert.False(result.IsValid);
        Assert.Contains("ShortAnswerHasNoOptions", result.Errors);
    }

    [Fact]
    public void Ordering_RequiresAtLeastTwoItems_NoCorrect()
    {
        var oneItem = QuestionValidator.ValidateForVersion(
            QuestionType.Ordering,
            "رتب الحروف",
            null,
            "ar",
            "{}",
            [new OptionSpec("A", false)],
            hasMedia: false);
        Assert.False(oneItem.IsValid);

        var valid = QuestionValidator.ValidateForVersion(
            QuestionType.Ordering,
            "رتب الحروف",
            null,
            "ar",
            "{}",
            [new OptionSpec("أ", false), new OptionSpec("ب", false)],
            hasMedia: false);
        Assert.True(valid.IsValid);
    }

    [Fact]
    public void Listening_RequiresMedia()
    {
        var noMedia = QuestionValidator.ValidateForVersion(
            QuestionType.Listening,
            "ما الذي سمعته؟",
            null,
            "ar",
            "{}",
            TwoOptionsOneCorrect,
            hasMedia: false);
        Assert.False(noMedia.IsValid);
        Assert.Contains("ListeningRequiresAudio", noMedia.Errors);

        var withMedia = QuestionValidator.ValidateForVersion(
            QuestionType.Listening,
            "ما الذي سمعته؟",
            null,
            "ar",
            "{}",
            TwoOptionsOneCorrect,
            hasMedia: true);
        Assert.True(withMedia.IsValid);
    }

    [Fact]
    public void Prompt_TooLongOrEmpty_FailsForAnyType()
    {
        var empty = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice, "", null, "ar", "{}", TwoOptionsOneCorrect, false);
        Assert.False(empty.IsValid);

        var tooLong = new string('a', QuestionValidator.MaxPromptLength + 1);
        var longPrompt = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice, tooLong, null, "ar", "{}", TwoOptionsOneCorrect, false);
        Assert.False(longPrompt.IsValid);
    }

    [Fact]
    public void Language_MustBeArabicOrEnglish()
    {
        var result = QuestionValidator.ValidateForVersion(
            QuestionType.MultipleChoice, "prompt", null, "fr", "{}", TwoOptionsOneCorrect, false);
        Assert.False(result.IsValid);
        Assert.Contains("UnsupportedLanguage", result.Errors);
    }
}
