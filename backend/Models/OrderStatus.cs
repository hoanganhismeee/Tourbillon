// Order lifecycle states for Stripe checkout flow
namespace backend.Models;

public enum OrderStatus
{
    Pending = 0,
    Confirmed = 1,
    Failed = 2,
    Cancelled = 3
}
