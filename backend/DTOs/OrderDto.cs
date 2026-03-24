// Response DTOs for order endpoints
namespace backend.Models;

public class CreateOrderResponseDto
{
    public int OrderId { get; set; }
    public string ClientSecret { get; set; } = string.Empty;
}

public class OrderDto
{
    public int Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "usd";
    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public OrderShippingDto Shipping { get; set; } = new();
    public List<OrderItemDto> Items { get; set; } = new();
}

public class OrderShippingDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
}

public class OrderItemDto
{
    public int WatchId { get; set; }
    public string WatchName { get; set; } = string.Empty;
    public string? WatchDescription { get; set; }
    public string? WatchImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
