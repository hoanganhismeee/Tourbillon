// Order business logic — price validation, Stripe PaymentIntent creation, webhook handling
using backend.Database;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class OrderService : IOrderService
{
    private readonly TourbillonContext _context;
    private readonly IStripeService _stripe;
    private readonly UserManager<User> _userManager;

    public OrderService(TourbillonContext context, IStripeService stripe, UserManager<User> userManager)
    {
        _context = context;
        _stripe = stripe;
        _userManager = userManager;
    }

    public async Task<(Order Order, string ClientSecret)> CreateOrderAsync(int? userId, CreateOrderDto dto)
    {
        // Collect requested watch IDs
        var watchIds = dto.Items.Select(i => i.WatchId).Distinct().ToList();
        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Where(w => watchIds.Contains(w.Id))
            .ToListAsync();

        // Validate all watches exist
        var missingIds = watchIds.Except(watches.Select(w => w.Id)).ToList();
        if (missingIds.Any())
            throw new InvalidOperationException($"Watches not found: {string.Join(", ", missingIds)}");

        // Reject PoR watches (price = 0)
        var porWatches = watches.Where(w => w.CurrentPrice <= 0).ToList();
        if (porWatches.Any())
            throw new InvalidOperationException(
                $"Cannot purchase Price on Request watches: {string.Join(", ", porWatches.Select(w => w.Name))}");

        // Build order with shipping info
        var order = new Order
        {
            UserId = userId,
            IsGuest = userId == null,
            Currency = "usd",
            CreatedAt = DateTime.UtcNow
        };

        // Resolve shipping: DTO fields first, then user profile fallback
        if (userId != null)
        {
            var user = await _userManager.FindByIdAsync(userId.Value.ToString());
            order.ShippingFirstName = dto.ShippingFirstName ?? user?.FirstName ?? string.Empty;
            order.ShippingLastName = dto.ShippingLastName ?? user?.LastName ?? string.Empty;
            order.ShippingEmail = dto.ShippingEmail ?? user?.Email ?? string.Empty;
            order.ShippingAddress = dto.ShippingAddress ?? user?.Address ?? string.Empty;
            order.ShippingCity = dto.ShippingCity ?? user?.City ?? string.Empty;
            order.ShippingState = dto.ShippingState ?? user?.State ?? string.Empty;
            order.ShippingCountry = dto.ShippingCountry ?? user?.Country ?? string.Empty;
        }
        else
        {
            // Guest checkout — shipping from DTO
            order.ShippingFirstName = dto.ShippingFirstName ?? string.Empty;
            order.ShippingLastName = dto.ShippingLastName ?? string.Empty;
            order.ShippingEmail = dto.GuestEmail ?? dto.ShippingEmail ?? string.Empty;
            order.ShippingAddress = dto.ShippingAddress ?? string.Empty;
            order.ShippingCity = dto.ShippingCity ?? string.Empty;
            order.ShippingState = dto.ShippingState ?? string.Empty;
            order.ShippingCountry = dto.ShippingCountry ?? string.Empty;
        }

        // Build order items from DB prices (server is source of truth)
        var watchLookup = watches.ToDictionary(w => w.Id);
        foreach (var item in dto.Items)
        {
            var watch = watchLookup[item.WatchId];
            order.Items.Add(new OrderItem
            {
                WatchId = watch.Id,
                WatchName = watch.Name,
                WatchDescription = watch.Description,
                WatchImage = watch.Image,
                UnitPrice = watch.CurrentPrice,
                Quantity = item.Quantity
            });
        }

        order.TotalAmount = order.Items.Sum(i => i.UnitPrice * i.Quantity);

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Create Stripe PaymentIntent
        var metadata = new Dictionary<string, string> { { "orderId", order.Id.ToString() } };
        var (paymentIntentId, clientSecret) = await _stripe.CreatePaymentIntentAsync(
            order.TotalAmount, order.Currency, metadata);

        order.StripePaymentIntentId = paymentIntentId;
        await _context.SaveChangesAsync();

        return (order, clientSecret);
    }

    /// Idempotent — safe to call multiple times for the same event
    public async Task<bool> ConfirmOrderAsync(string paymentIntentId)
    {
        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.StripePaymentIntentId == paymentIntentId);
        if (order == null) return false;
        if (order.Status == OrderStatus.Confirmed) return true;

        order.Status = OrderStatus.Confirmed;
        order.ConfirmedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> FailOrderAsync(string paymentIntentId)
    {
        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.StripePaymentIntentId == paymentIntentId);
        if (order == null) return false;
        if (order.Status != OrderStatus.Pending) return false;

        order.Status = OrderStatus.Failed;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<Order?> GetOrderByIdAsync(int orderId, int? userId)
    {
        var query = _context.Orders.Include(o => o.Items).AsQueryable();

        if (userId != null)
            return await query.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

        // Guest access — by orderId only (no user ownership check)
        return await query.FirstOrDefaultAsync(o => o.Id == orderId && o.IsGuest);
    }

    public async Task<List<Order>> GetUserOrdersAsync(int userId)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }
}
