namespace TeacherPlatform.Domain.Saas;

public sealed class Plan
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string LimitsJson { get; set; } = "{}";
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
