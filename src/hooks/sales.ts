import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; 
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/axios';
import { useOfflineSaleStore } from '@/store/offline-sale';
import { useAuthStore } from '@/store/pos-auth-store';
import { ProcessSaleInput } from '@/lib/validation/transactions';

export const processSaleApi = async (data: ProcessSaleInput, locationId?: string) => {
  const response = await apiClient.post(`/api/v1/pos/sale/process?locationId=${locationId}&enableStockTracking=true`, {...data, locationId});
  return response.data;
};

// Helper to determine if an error is specifically a connection issue
export const isNetworkError = (error: unknown): boolean => {
  if (isAxiosError(error)) {
    // ERR_NETWORK is standard for Axios connection failures
    // !error.response implies the request was made but no response received
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

/**
 * Hook to process a new sale.
 * Automatically handles offline queuing.
 */
/**
 * Hook to process a new sale.
 * NOW LOCAL-FIRST: Saves to local DB immediately, then syncs in background.
 */
export const useProcessSale = () => {
  const addToQueue = useOfflineSaleStore(state => state.addToQueue);
  const { syncSales } = useSyncOfflineSales();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProcessSaleInput) => {
      // 1. Local First: Save to store immediately
      const queuedSale = addToQueue(data);
      
      // 2. Trigger background sync (fire and forget)
      // We don't await this because we want immediate UI feedback
      syncSales();

      return queuedSale;
    },

    onSuccess: () => {
      toast.success('Sale processed successfully');
      // Invalidate queries to show the new sale in lists (if we pull from local state or if we want to refresh)
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },

    onError: (error) => {
      console.error("Critical error saving sale locally:", error);
      toast.error("Failed to save sale locally. Please try again.");
    }
  });
};

/**
 * Hook to sync offline sales.
 * Call this inside a useEffect in your main layout or a "Sync" button.
 */
export const useSyncOfflineSales = () => {
  const { getPendingSales, updateQueueItem } = useOfflineSaleStore();
  const queryClient = useQueryClient();
  const locationId = useAuthStore(state => state.currentLocation?.id);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const pendingSales = getPendingSales();
      if (pendingSales.length === 0) return;

      const results = [];

      for (const sale of pendingSales) {
        try {
          // Update status to SYNCING
          updateQueueItem(sale.id, { status: 'SYNCING' });

          // Attempt API call
          const result = await processSaleApi(sale.data, locationId);

          // Success!
          updateQueueItem(sale.id, { status: 'SYNCED' });
          // Optional: Remove from queue after a delay or immediately if we don't want history
          // removeFromQueue(sale.id); 
          
          results.push(result);
        } catch (error) {
          console.error(`Failed to sync sale ${sale.id}:`, error);
          
          // const isNetwork = isNetworkError(error);
          const errorMessage = (error as any)?.response?.data?.error || (error as Error).message;

          // Update status to FAILED but keep in queue
          updateQueueItem(sale.id, { 
            status: 'FAILED', 
            retryCount: (sale.retryCount || 0) + 1,
            lastError: errorMessage
          });

          // If it's a validation error (400), it might never succeed. 
          // For now, we keep it as FAILED so the user can see it in a "Failed Sales" list.
        }
      }
      return results;
    },
    onSuccess: data => {
      if (data && data.length > 0) {
        // toast.success(`${data.length} sales synced to server.`);
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    },
  });

  return {
    syncSales: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    pendingCount: getPendingSales().length,
  };
};



export interface OrderFormValues {
  // Define your order form values interface
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
