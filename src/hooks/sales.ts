import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { ProcessSaleInput } from '@/lib/validation/transactions';
import { invoke } from '@tauri-apps/api/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// --- Types & Enums ---

export const isNetworkError = (error: unknown): boolean => {
  if (isAxiosError(error)) {
    return error.code === 'ERR_NETWORK' || !error.response;
  }
  return false;
};

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  CARD = 'CARD',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  STORE_CREDIT = 'STORE_CREDIT',
  GIFT_CARD = 'GIFT_CARD',
  LOYALTY_POINTS = 'LOYALTY_POINTS',
  ON_ACCOUNT = 'ON_ACCOUNT',
  MPESA = 'MPESA',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  CANCELLED = 'CANCELLED',
  VOIDED = 'VOIDED',
}

export const FulfillmentType = {
  IMMEDIATE: "IMMEDIATE",
  PICKUP: "PICKUP",
  DELIVERY: "DELIVERY",
  SHIPPING: "SHIPPING",
  DIGITAL: "DIGITAL",
  DINE_IN: "DINE_IN",
  SERVICE: "SERVICE"
} as const;

export enum TransactionType {
  POS_SALE = "POS_SALE",
  ONLINE_ORDER = "ONLINE_ORDER",
  SALES_ORDER = "SALES_ORDER",
  SERVICE_BOOKING = "SERVICE_BOOKING",
  SUBSCRIPTION = "SUBSCRIPTION",
  QUOTE = "QUOTE"
}

// --- Rust Response Types ---
interface RustSaleResponse {
  success: boolean;
  message: string;
  server_response?: any; // Now optional as backend processes in background
}

interface RustQueuedSale {
  id: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  retryCount: number;
  timestamp: number;
  locationId: string;
  lastError?: string;
  transactionData: {
    saleNumber: string;
    customerId: string | null;
    paymentMethod: "CASH" | "MPESA" | "CARD";
    paymentStatus: "COMPLETED" | "PENDING" | "FAILED";
    mpesaPhoneNumber?: string;
    amountReceived: number;
    change: number;
    discountAmount: number;
    isWholesale: boolean;
    enableStockTracking: boolean;
    locationId: string;
    notes: string;
    cartItems: Array<{
      productId: string;
      productName?: string;
      variantId: string;
      variantName?: string;
      quantity: number;
      sellingUnitId: string;
      sellingUnitName?: string;
      unitPrice?: number;
    }>;
  };
}

export type { RustQueuedSale };

// --- Hooks ---

/**
 * Hook to process a new sale via Rust Backend.
 * 1. Generates UUID.
 * 2. Sends to Rust (which encrypts & saves to disk).
 * 3. Rust attempts background sync immediately.
 */
export const useProcessSale = () => {
  const { currentLocation } = useAuthStore();
  const locationId = currentLocation?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProcessSaleInput) => {
      if (!locationId) throw new Error("Location ID is missing");

      // Generate a UUID for the sale to track it locally and remotely
      const saleId = crypto.randomUUID();

      // Combine data for Rust
      const payload = {
        ...data,
        locationId
      };

      // Call Rust Command (Non-blocking background process)
      const response = await invoke<RustSaleResponse>('process_sale_command', {
        saleId,
        payload,
      });

      return { ...response, saleId };
    },
    onSuccess: (data) => {
      // Invalidate queries to update local stock counts or sales lists
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pos-sales-queue'] });

      // If it was an offline queue or background process
      if (data.message.toLowerCase().includes('background') || data.message.toLowerCase().includes('offline')) {
        // Don't show success toast here for M-Pesa, the UI handles the "Waiting" state
        console.log("Sale processed in background:", data.message);
      } else {
        toast.success('Sale Processed', {
          description: 'Transaction saved successfully.',
          duration: 2000,
        });
      }
    },
    onError: (error) => {
      console.error("Critical error processing sale:", error);
      toast.error("System Error", {
        description: "Failed to process sale. Please check logs.",
      });
    }
  });
};

export const usePendingSales = () => {
  const { data: pendingSales = [], isLoading, error } = useQuery({
    queryKey: ['pos-sales-queue'],
    queryFn: async () => {
       const sales = await invoke<RustQueuedSale[]>('get_pending_sales_command');
       return sales;
    },
    refetchInterval: 5000 // Poll every 5s to see if queue clears
  });

  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: async () => {
       // Trigger manual sync
       const count = await invoke<number>('sync_sales_command', {});
       return count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-sales-queue'] });
      toast.success("Sync Complete");
    }
  });

  return {
    syncSales: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    pendingCount: pendingSales.length,
    pendingSales,
    isLoading,
    error
  };
};

//For manual sales (Direct API - Deprecated for POS, used for online orders/fallback)
export const processSaleApi = async (data: ProcessSaleInput, locationId: string) => {
  const response = await apiClient.post(`/api/v1/pos/sale/process?locationId=${locationId}&enableStockTracking=true`, data);
  return response.data;
};

export const useCreateOrder = (options: UseCreateOrderOptions = {}) => {
  const { currentLocation } = useAuthStore();
  const locationId = currentLocation?.id;

  return useMutation({
    mutationFn: async (newOrder: OrderFormValues) => {
      const response = await apiClient.post(`/api/v1/pos/orders?locationId=${locationId}`, newOrder);
      return response.data;
    },
    onSuccess: (data) => {
      options.onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Failed to create order:', error);
      options.onError?.(error);
    },
    onSettled: options.onSettled,
  });
};

// --- Order Creation Hook (Online Only / Special Orders) ---
export interface OrderFormValues {
  [key: string]: any;
}

export interface UseCreateOrderOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}
