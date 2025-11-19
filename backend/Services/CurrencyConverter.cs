// Currency converter service for watch prices
// Converts between major currencies (USD, EUR, AUD, JPY, CNY) and formats prices

namespace backend.Services;

public class CurrencyConverter
{
    // Exchange rates relative to AUD (as of implementation)
    private readonly Dictionary<string, decimal> _exchangeRates = new()
    {
        { "AUD", 1.00m },
        { "USD", 1.52m },   // 1 USD = 1.52 AUD
        { "EUR", 1.64m },   // 1 EUR = 1.64 AUD
        { "GBP", 1.93m },   // 1 GBP = 1.93 AUD
        { "JPY", 0.010m },  // 1 JPY = 0.010 AUD
        { "CNY", 0.21m }    // 1 CNY = 0.21 AUD
    };

    /// Detects currency symbol from price string and returns currency code
    public string DetectCurrency(string priceString)
    {
        if (string.IsNullOrEmpty(priceString))
            return "USD"; // Default to USD

        priceString = priceString.Trim();

        // Check for currency symbols
        if (priceString.Contains("€") || priceString.ToUpper().Contains("EUR"))
            return "EUR";
        if (priceString.Contains("£") || priceString.ToUpper().Contains("GBP"))
            return "GBP";
        if (priceString.Contains("¥") || priceString.ToUpper().Contains("JPY"))
            return "JPY";
        if (priceString.Contains("¥") || priceString.ToUpper().Contains("CNY") || priceString.ToUpper().Contains("RMB"))
            return "CNY";
        if (priceString.ToUpper().Contains("AUD") || priceString.ToUpper().Contains("AU$"))
            return "AUD";

        // Default to USD for $ symbol
        return "USD";
    }

    /// Converts amount from specified currency to AUD
    public decimal ConvertToAUD(decimal amount, string fromCurrency)
    {
        if (string.IsNullOrEmpty(fromCurrency))
            fromCurrency = "USD";

        fromCurrency = fromCurrency.ToUpper();

        if (!_exchangeRates.ContainsKey(fromCurrency))
        {
            // Unknown currency, assume USD
            fromCurrency = "USD";
        }

        // If already in AUD, return as is
        if (fromCurrency == "AUD")
            return amount;

        // Convert to AUD
        decimal audAmount = amount * _exchangeRates[fromCurrency];
        
        // Round to nearest whole number
        return Math.Round(audAmount, 0);
    }

    /// Formats price in AUD with thousands separator and .00 decimal
    public string FormatPriceAUD(decimal price)
    {
        if (price <= 0)
            return "Price on request";

        // Round to thousands (e.g., 113456 → 113000)
        decimal roundedPrice = Math.Round(price / 1000) * 1000;

        // Format with thousands separator and .00 decimal
        return $"${roundedPrice:N0}.00";
    }

    /// Parses price string, detects currency, converts to AUD, and returns decimal value
    public decimal ParseAndConvertToAUD(string priceString)
    {
        if (string.IsNullOrEmpty(priceString) ||
            priceString.ToLower().Contains("request") ||
            priceString.ToLower().Contains("contact"))
        {
            return 0;
        }

        // Detect currency
        string currency = DetectCurrency(priceString);

        // Remove currency symbols, commas, and spaces
        var cleanPrice = priceString
            .Replace("$", "")
            .Replace("€", "")
            .Replace("£", "")
            .Replace("¥", "")
            .Replace(",", "")
            .Replace(" ", "")
            .Replace("AUD", "")
            .Replace("USD", "")
            .Replace("EUR", "")
            .Replace("GBP", "")
            .Replace("JPY", "")
            .Replace("CNY", "")
            .Replace("RMB", "")
            .Trim();

        if (decimal.TryParse(cleanPrice, out decimal amount))
        {
            return ConvertToAUD(amount, currency);
        }

        return 0;
    }
}

