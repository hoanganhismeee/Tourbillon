// Stripe integration — PaymentIntent creation and webhook signature verification
using Stripe;

namespace backend.Services;

public class StripeService : IStripeService
{
    private readonly string _webhookSecret;

    public StripeService(IConfiguration configuration, ILogger<StripeService> logger)
    {
        StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey not configured in user-secrets");
        _webhookSecret = configuration["Stripe:WebhookSecret"] ?? string.Empty;
        if (string.IsNullOrEmpty(_webhookSecret))
            logger.LogWarning("Stripe:WebhookSecret not configured — webhook verification will fail. " +
                "Run: stripe listen --forward-to http://localhost:5248/api/order/webhook");
    }

    public async Task<(string PaymentIntentId, string ClientSecret)> CreatePaymentIntentAsync(
        decimal amount, string currency, Dictionary<string, string>? metadata = null)
    {
        // Stripe expects amount in smallest currency unit (cents for USD)
        var amountInCents = (long)(amount * 100);

        var options = new PaymentIntentCreateOptions
        {
            Amount = amountInCents,
            Currency = currency,
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions { Enabled = true },
            Metadata = metadata
        };

        var service = new PaymentIntentService();
        var intent = await service.CreateAsync(options);
        return (intent.Id, intent.ClientSecret);
    }

    public Event ConstructWebhookEvent(string json, string signatureHeader)
    {
        return EventUtility.ConstructEvent(json, signatureHeader, _webhookSecret);
    }
}
