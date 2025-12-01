import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; 
import { AxiosError, isAxiosError } from 'axios';
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
export const useProcessSale = () => {
  const addToQueue = useOfflineSaleStore(state => state.addToQueue);
  const locationId = useAuthStore(state => state.currentLocation?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProcessSaleInput) => processSaleApi(data, locationId),

    // We use onMutate to allow for immediate UI feedback if needed
    onMutate: async () => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['sales'] });
    },

    onSuccess: () => {
      toast.success('Sale processed successfully');
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },

    onError: (error: AxiosError | Error, variables: ProcessSaleInput) => {
      // CHECK: Is this a network error?
      if (isNetworkError(error)) {
        console.warn('Network error detected. Queuing sale.');

        // 1. Save to Zustand Store
        addToQueue(variables);

        // 2. Notify user differently
        toast.warning('Device offline. Sale saved to outbox and will sync later.');

        // 3. OPTIONAL: You might want to treat this as a "soft success"
        // to clear the cart in the UI.
        // If so, you'd handle clearing logic in the component based on this specific error flow.
        return;
      }

      // Handle standard server errors (400, 500)
      const errorMessage = (error as AxiosError<{ error: string }>)?.response?.data?.error || 'Failed to process sale';

      toast.error(errorMessage);
    },
  });
};

/**
 * Hook to sync offline sales.
 * Call this inside a useEffect in your main layout or a "Sync" button.
 */
export const useSyncOfflineSales = () => {
  const { queue, removeFromQueue } = useOfflineSaleStore();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (queue.length === 0) return;

      const results = [];

      // Process queue sequentially to maintain order
      for (const item of queue) {
        try {
          const result = await processSaleApi(item.data);
          removeFromQueue(item.id); // Remove from queue only on success
          results.push(result);
        } catch (error) {
          // If it's a validation error (400), we must remove it or it will block the queue forever.
          // If it's still a network error, we leave it in the queue.
          if (!isNetworkError(error)) {
            console.error('Validation error in queued item, removing:', item);
            removeFromQueue(item.id);
            // Ideally, you would move this to a "Failed Permanently" log
          }
        }
      }
      return results;
    },
    onSuccess: data => {
      if (data && data.length > 0) {
        toast.success(`${data.length} offline sales synced successfully.`);
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    },
  });

  return {
    syncSales: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    pendingCount: queue.length,
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
