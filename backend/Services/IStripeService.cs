// Stripe payment intent creation and webhook verification
namespace backend.Services;

public interface IStripeService
{
    Task<(string PaymentIntentId, string ClientSecret)> CreatePaymentIntentAsync(
        decimal amount, string currency, Dictionary<string, string>? metadata = null);
    Stripe.Event ConstructWebhookEvent(string json, string signatureHeader);
}
