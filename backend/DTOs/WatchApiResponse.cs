// DTOs for The Watch API responses
// These map the external API structure to our internal models

namespace backend.DTOs;

public class WatchApiListResponse
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
    public List<WatchApiDto> Data { get; set; } = new();
}

public class WatchApiDto
{
    public string? Id { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? Reference { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Description { get; set; }
    public string? Movement { get; set; }
    public string? CaseMaterial { get; set; }
    public string? CaseDiameter { get; set; }
    public int? YearOfProduction { get; set; }
    public decimal? Price { get; set; }
    public string? ImageUrl { get; set; }
    public List<string>? Images { get; set; }
    public string? Collection { get; set; }
    public string? Specs { get; set; }
    public DateTime? LastUpdated { get; set; }
}

public class BrandApiResponse
{
    public List<BrandApiDto> Data { get; set; } = new();
}

public class BrandApiDto
{
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Summary { get; set; }
    public string? Image { get; set; }
    public string? ImageUrl { get; set; }
}

public class CollectionApiDto
{
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? BrandId { get; set; }
    public string? BrandName { get; set; }
    public string? Image { get; set; }
}
