import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { apiClient, API_ENDPOINT } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { ProcessSaleInput } from '@/lib/validation/transactions';
import { invoke } from '@tauri-apps/api/core';

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
  server_response?: any;
}

interface RustQueuedSale {
  id: string;
  status: string;
  retry_count: number;
}

// --- Hooks ---

/**
 * Hook to process a new sale via Rust Backend.
 * 1. Generates UUID.
 * 2. Sends to Rust (which encrypts & saves to disk).
 * 3. Rust attempts immediate sync.
 */
export const useProcessSale = () => {
  // Assuming useAuthStore contains the deviceKey as well (it should based on store.rs context)
  const { currentLocation, memberToken, deviceKey } = useAuthStore();
  const locationId = currentLocation?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProcessSaleInput) => {
      if (!locationId) throw new Error("Location ID is missing");

      // Generate a UUID for the sale to track it locally and remotely
      const saleId = crypto.randomUUID();

      // Combine data for Rust
      const payload = { ...data, locationId };

      const response = await invoke<RustSaleResponse>('process_sale_command', {
        saleId,
        locationId,
        payload,
        baseUrl: API_ENDPOINT,
        deviceKey: deviceKey || null, // <--- Added
        memberToken: memberToken || null
      });

      return response;
    },

    onSuccess: (data) => {
      // Invalidate queries to update local stock counts or sales lists
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pos-sales-queue'] });

      // Check the message from Rust to see if it was synced or queued
      if (data.message.toLowerCase().includes('offline')) {
        toast.warning('Saved Offline', {
            description: 'Network unreachable. Sale queued securely.',
            duration: 3000
        });
      } else {
        toast.success('Sale Processed', {
            description: 'Transaction completed successfully.',
            duration: 2000
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

/**
 * Hook to sync offline sales.
 * Triggers the background Rust worker.
 */
export const useSyncOfflineSales = () => {
  const { memberToken, deviceKey } = useAuthStore(); // <--- Get deviceKey
  const queryClient = useQueryClient();

  // Helper query to get the count of pending items from Rust
  const { data: pendingSales = [] } = useQuery({
    queryKey: ['pos-sales-queue'],
    queryFn: async () => {
        return await invoke<RustQueuedSale[]>('get_pending_sales_command');
    },
    // Poll every 5 seconds to keep the badge updated
    refetchInterval: 5000, 
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      console.log(`[Sync] Triggering background sync...`);
      
      const response = await invoke<string>('sync_sales_command', {
        baseUrl: API_ENDPOINT,
        deviceKey: deviceKey || null, // <--- Added
        memberToken: memberToken || null
      });
      
      return response;
    },
    onSuccess: (message) => {
      // Message format: "Synced X sales"
      if (message !== "Synced 0 sales") {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['pos-sales-queue'] });
      }
    },
    onError: (err) => {
      console.error("Sync failed:", err);
    }
  });

  return {
    syncSales: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    pendingCount: pendingSales.length,
    pendingSales // Exposed if you need to list them in a UI drawer
  };
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

//For manual sales using mpesa
export const processSaleApi = async (data: ProcessSaleInput, locationId?: string) => {
  // Ensure we pass flags for detailed stock tracking if needed
  const response = await apiClient.post(
    `/api/v1/pos/sale/process?locationId=${locationId}&enableStockTracking=true`, 
    { ...data, locationId }
  );
  return response.data;
};