import { usePosStore } from "@/store/store";
import { clsx, type ClassValue } from "clsx"
import { useMemo } from "react";
import { twMerge } from "tailwind-merge"

import { isTauri } from '@tauri-apps/api/core';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { documentDir } from '@tauri-apps/api/path';
import { toast } from "sonner";
import { Store } from "@tauri-apps/plugin-store";

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

  // Helper to handle Tauri vs Browser download logic to avoid code duplication
export const processFileDownload = async (blob: Blob, fileName: string, loadingToastId: string | number) => {
    try {
      if (isTauri()) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Ensure directory exists
        if (!(await exists('Dealio', { baseDir: BaseDirectory.Download }))) {
          await mkdir('Dealio', { baseDir: BaseDirectory.Download, recursive: true });
        }
        
        const documentDirPath = await documentDir();
        const filePath = `${documentDirPath}/Dealio/${fileName}`;
        
        await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Download });
        
        // Update loading toast to success
        toast.success(`Saved ${fileName} to Downloads`, {
          description: 'File saved successfully',
          id: loadingToastId,
          action: {
            label: 'Open',
            onClick: async () => {
              try {
                const { openPath } = await import('@tauri-apps/plugin-opener');
                await openPath(filePath);
              } catch (e) {
                console.error('Could not open file', e);
              }
            },
          },
          duration: 5000,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Update loading toast to success
        toast.success('Download started', {
          description: `${fileName} is being downloaded`,
          id: loadingToastId,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      toast.error('Failed to save file', {
        description: 'An error occurred while saving the file',
        id: loadingToastId
      });
      throw error;
    }
  }
  
export async function safeStoreSet<T>(store: Store, key: string, value: T | undefined) {
  // JSON supports null, but passing 'undefined' to Tauri's IPC bridge breaks the command
  const safeValue = value === undefined ? null : value;
  await store.set(key, safeValue);
}