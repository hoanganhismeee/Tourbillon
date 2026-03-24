// Order lifecycle management — creation, confirmation, retrieval
using backend.Models;

namespace backend.Services;

public interface IOrderService
{
    Task<(Order Order, string ClientSecret)> CreateOrderAsync(int? userId, CreateOrderDto dto);
    Task<bool> ConfirmOrderAsync(string paymentIntentId);
    Task<bool> FailOrderAsync(string paymentIntentId);
    Task<Order?> GetOrderByIdAsync(int orderId, int? userId);
    Task<List<Order>> GetUserOrdersAsync(int userId);
}
