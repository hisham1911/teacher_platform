using System.Collections.Generic;
using System.Linq;
using TeacherPlatform.Domain.Sessions;
using Xunit;

namespace TeacherPlatform.Domain.Tests;

/// <summary>اختبارات الخلط الحتمي — نفس البذرة تعطي نفس الترتيب دائمًا (استئناف بعد F5).</summary>
public class SeededShufflerTests
{
    private static readonly IReadOnlyList<int> Items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    [Fact]
    public void Shuffle_SameSeed_ProducesSameOrder()
    {
        var first = SeededShuffler.Shuffle(Items, seed: 42);
        var second = SeededShuffler.Shuffle(Items, seed: 42);

        Assert.Equal(first, second);
    }

    [Fact]
    public void Shuffle_DifferentSeeds_ProduceDifferentOrders()
    {
        var first = SeededShuffler.Shuffle(Items, seed: 1);
        var second = SeededShuffler.Shuffle(Items, seed: 2);

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void Shuffle_IsValidPermutation()
    {
        var shuffled = SeededShuffler.Shuffle(Items, seed: 99);

        Assert.Equal(Items.Count, shuffled.Count);
        Assert.Equal(Items.OrderBy(x => x), shuffled.OrderBy(x => x));
    }

    [Fact]
    public void Shuffle_DoesNotMutateInput()
    {
        var input = new List<int> { 1, 2, 3, 4, 5 };
        var snapshot = input.ToArray();

        _ = SeededShuffler.Shuffle(input, seed: 7);

        Assert.Equal(snapshot, input);
    }

    [Fact]
    public void Shuffle_SingleItem_ReturnsSameItem()
    {
        var shuffled = SeededShuffler.Shuffle([42], seed: 123);

        Assert.Equal([42], shuffled);
    }

    [Fact]
    public void MaybeShuffle_WhenDisabled_ReturnsOriginalOrder()
    {
        var result = SeededShuffler.MaybeShuffle(Items, seed: 42, enabled: false);

        Assert.Equal(Items, result);
    }

    [Fact]
    public void MaybeShuffle_WhenEnabled_MatchesShuffle()
    {
        var expected = SeededShuffler.Shuffle(Items, seed: 42);
        var result = SeededShuffler.MaybeShuffle(Items, seed: 42, enabled: true);

        Assert.Equal(expected, result);
    }
}
