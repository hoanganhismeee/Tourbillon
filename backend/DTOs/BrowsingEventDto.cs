namespace backend.DTOs;

public class BrowsingEventBatchDto
{
    public string? AnonymousId { get; set; }
    public List<BrowsingEventItemDto> Events { get; set; } = new();
}

public class BrowsingEventItemDto
{
    public string EventType { get; set; } = string.Empty;
    public int? EntityId { get; set; }
    public string? EntityName { get; set; }
    public int? BrandId { get; set; }
    public DateTime Timestamp { get; set; }
}

public class MergeAnonymousDto
{
    public string AnonymousId { get; set; } = string.Empty;
}
