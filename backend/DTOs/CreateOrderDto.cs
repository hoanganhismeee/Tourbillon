// DTOs for order creation — accepts cart items and optional shipping overrides
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class CartItemDto
{
    [Required]
    public int WatchId { get; set; }
    public int Quantity { get; set; } = 1;
}

public class CreateOrderDto
{
    [Required]
    [MinLength(1)]
    public List<CartItemDto> Items { get; set; } = new();

    // Shipping — required for guest, optional override for signed-in users
    public string? ShippingFirstName { get; set; }
    public string? ShippingLastName { get; set; }
    public string? ShippingEmail { get; set; }
    public string? ShippingAddress { get; set; }
    public string? ShippingCity { get; set; }
    public string? ShippingState { get; set; }
    public string? ShippingCountry { get; set; }

    // Required for guest checkout
    public string? GuestEmail { get; set; }
}
