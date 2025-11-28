import { usePosStore } from "@/store/store";
import { clsx, type ClassValue } from "clsx"
import { useMemo } from "react";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const useFormattedCurrency = (): ((
  amount: number | string,
  options?: Intl.NumberFormatOptions
) => string) => {
  // Get the organization from the application store
  const { settings: { currency: storeCurrency } } = usePosStore();

  const currency = storeCurrency || 'USD';

  // Determine the user's locale: use navigator.language if available, otherwise fallback to 'en-US'
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  // Return a memoized formatting function that depends on currency and locale
  return useMemo(() => {
    return (amount: number | string, options: Intl.NumberFormatOptions = {}): string => {
      // Parse the amount to a number, handling different input types
      let parsedAmount: number;
      if (typeof amount === 'string') {
        parsedAmount = parseFloat(amount);
      } else {
        parsedAmount = amount as number;
      }

      // Handle invalid amounts
      if (isNaN(parsedAmount)) {
        console.warn('Invalid amount provided to formatCurrency:', amount);
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2, // Default to 2 decimal places for invalid amounts
          ...options,
        }).format(0); // Format 0 with the correct currency symbol
      }

      // Attempt to format the amount using Intl.NumberFormat
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2, // Default to 2 decimal places unless overridden
          ...options, // Merge any additional formatting options
        }).format(parsedAmount);
      } catch (error) {
        // Fallback to basic formatting with the currency symbol
        console.error(`Error formatting currency (locale: ${locale}, currency: ${currency}):`, error);
        const fallbackFormatter = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'USD', // Fallback to USD if the currency is invalid
          maximumFractionDigits: options.maximumFractionDigits ?? 2,
        });
        return fallbackFormatter.format(parsedAmount);
      }
    };
  }, [currency, locale]); // Recreate the formatting function only when currency or locale changes
};
