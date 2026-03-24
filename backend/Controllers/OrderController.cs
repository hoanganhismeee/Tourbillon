// Handles Stripe checkout flow — order creation, retrieval, and webhook processing.
// POST /api/order is AllowAnonymous to support guest checkout.
// POST /api/order/webhook uses Stripe signature verification instead of cookie auth.
using System.Security.Claims;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IStripeService _stripeService;
    private readonly ILogger<OrderController> _logger;

    public OrderController(IOrderService orderService, IStripeService stripeService, ILogger<OrderController> logger)
    {
        _orderService = orderService;
        _stripeService = stripeService;
        _logger = logger;
    }

    // POST /api/order — create order + Stripe PaymentIntent (guest or signed-in)
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var (order, clientSecret) = await _orderService.CreateOrderAsync(userId, dto);

            return Ok(new CreateOrderResponseDto
            {
                OrderId = order.Id,
                ClientSecret = clientSecret
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // GET /api/order — list current user's orders
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var orders = await _orderService.GetUserOrdersAsync(userId.Value);
        return Ok(orders.Select(MapToDto));
    }

    // GET /api/order/{id} — get single order (ownership check for signed-in, orderId-only for guest)
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOrder(int id)
    {
        var userId = GetCurrentUserId();
        var order = await _orderService.GetOrderByIdAsync(id, userId);
        if (order == null) return NotFound(new { message = "Order not found" });
        return Ok(MapToDto(order));
    }

    // POST /api/order/webhook — Stripe webhook endpoint (signature-verified, no cookie auth)
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        string json;
        using (var reader = new StreamReader(HttpContext.Request.Body))
        {
            json = await reader.ReadToEndAsync();
        }

        var signatureHeader = Request.Headers["Stripe-Signature"].FirstOrDefault();
        if (string.IsNullOrEmpty(signatureHeader))
            return BadRequest(new { message = "Missing Stripe-Signature header" });

        try
        {
            var stripeEvent = _stripeService.ConstructWebhookEvent(json, signatureHeader);

            switch (stripeEvent.Type)
            {
                case "payment_intent.succeeded":
                    var successIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
                    if (successIntent != null)
                        await _orderService.ConfirmOrderAsync(successIntent.Id);
                    break;

                case "payment_intent.payment_failed":
                    var failIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
                    if (failIntent != null)
                        await _orderService.FailOrderAsync(failIntent.Id);
                    break;

                case "payment_intent.canceled":
                    var cancelIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
                    if (cancelIntent != null)
                        await _orderService.FailOrderAsync(cancelIntent.Id);
                    break;
            }

            return Ok();
        }
        catch (Stripe.StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe webhook signature verification failed");
            return BadRequest(new { message = "Webhook signature verification failed" });
        }
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    private static OrderDto MapToDto(Order order) => new()
    {
        Id = order.Id,
        Status = order.Status.ToString(),
        TotalAmount = order.TotalAmount,
        Currency = order.Currency,
        CreatedAt = order.CreatedAt,
        ConfirmedAt = order.ConfirmedAt,
        Shipping = new OrderShippingDto
        {
            FirstName = order.ShippingFirstName,
            LastName = order.ShippingLastName,
            Email = order.ShippingEmail,
            Address = order.ShippingAddress,
            City = order.ShippingCity,
            State = order.ShippingState,
            Country = order.ShippingCountry
        },
        Items = order.Items.Select(i => new OrderItemDto
        {
            WatchId = i.WatchId,
            WatchName = i.WatchName,
            WatchDescription = i.WatchDescription,
            WatchImageUrl = i.WatchImage,
            UnitPrice = i.UnitPrice,
            Quantity = i.Quantity
        }).ToList()
    };
}
