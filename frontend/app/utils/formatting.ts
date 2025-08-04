// Utility functions for formatting data throughout the application

/**
 * Formats a price number into a currency string
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

/**
 * Formats a price for display, showing "Price on Request" for zero prices
 */
export const formatPriceDisplay = (price?: number): string => {
  if (!price || price === 0) {
    return 'Price on Request';
  }
  return formatPrice(price);
};

/**
 * Truncates text to a specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Capitalizes the first letter of each word
 */
export const capitalizeWords = (text: string): string => {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}; 