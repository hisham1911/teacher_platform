namespace TeacherPlatform.Domain.Sessions;

/// <summary>
/// خلط حتمي (Deterministic) مبني على ShuffleSeed الخاص بالمحاولة —
/// نفس البذرة تعطي نفس الترتيب دائمًا، فيستأنف الطالب نفس الترتيب بعد F5 أو إعادة تشغيل السيرفر.
/// Fisher–Yates مع Random مزروع بالبذرة.
/// </summary>
public static class SeededShuffler
{
    /// <summary>يعيد نسخة مخلوطة من القائمة حسب البذرة. لا يعدّل القائمة الأصلية.</summary>
    public static IReadOnlyList<T> Shuffle<T>(IReadOnlyList<T> items, int seed)
    {
        var result = items.ToArray();
        var random = new Random(seed);

        for (var i = result.Length - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (result[i], result[j]) = (result[j], result[i]);
        }

        return result;
    }

    /// <summary>يعيد القائمة كما هي أو مخلوطة حسب العلم — لتبسيط منطق اللاعب.</summary>
    public static IReadOnlyList<T> MaybeShuffle<T>(IReadOnlyList<T> items, int seed, bool enabled)
        => enabled ? Shuffle(items, seed) : items;
}
