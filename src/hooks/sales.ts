import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; 
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/axios';
import { useOfflineSaleStore } from '@/store/offline-sale';
import { useAuthStore } from '@/store/pos-auth-store';
import { ProcessSaleInput } from '@/lib/validation/transactions';
import { useEffect } from 'react';

// --- API Function ---

export const processSaleApi = async (data: ProcessSaleInput, locationId?: string) => {
  // Ensure we pass flags for detailed stock tracking if needed
  const response = await apiClient.post(
    `/api/v1/pos/sale/process?locationId=${locationId}&enableStockTracking=true`, 
    { ...data, locationId }
  );
  return response.data;
};

// --- Types & Enums (Same as before) ---

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

// --- Hooks ---

/**
 * Hook to process a new sale.
 * ENTERPRISE LEVEL: 
 * 1. Persists to file storage (Tauri Store) immediately.
 * 2. Optimistic UI updates.
 * 3. Background background sync.
 */
export const useProcessSale = () => {
  const addToQueue = useOfflineSaleStore(state => state.addToQueue);
  const initStore = useOfflineSaleStore(state => state.initStore);
  const isStoreReady = useOfflineSaleStore(state => state.isStoreReady);
  
  const { syncSales } = useSyncOfflineSales();
  const queryClient = useQueryClient();

  // Ensure store is ready before we try to process anything
  useEffect(() => {
    if (!isStoreReady) {
      initStore();
    }
  }, [isStoreReady, initStore]);

  return useMutation({
    mutationFn: async (data: ProcessSaleInput) => {
      if (!isStoreReady) {
        // Fallback: wait a moment or try init again if race condition
        await initStore(); 
      }

      // 1. Local First: Save to file store immediately
      // We await this to ensure data is safely on disk before confirming to user
      const queuedSale = await addToQueue(data);
      
      // 2. Trigger background sync
      // We intentionally do NOT await this. The user can start the next sale immediately.
      syncSales(); 

      return queuedSale;
    },

    onSuccess: () => {
      toast.success('Sale Processed', {
        description: 'Transaction saved locally. Syncing in background...',
        duration: 2000
      });
      
      // Invalidate queries to update local stock counts or sales lists
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },

    onError: (error) => {
      console.error("Critical error saving sale locally:", error);
      toast.error("System Error", {
        description: "Failed to save sale to local database. Check storage permissions.",
      });
    }
  });
};

/**
 * Hook to sync offline sales.
 * Robust sync engine that handles partial failures and retries.
 */
export const useSyncOfflineSales = () => {
  const { 
    getPendingSales, 
    updateQueueItem,
    isStoreReady, 
    initStore 
  } = useOfflineSaleStore();
  
  const queryClient = useQueryClient();
  const locationId = useAuthStore(state => state.currentLocation?.id);

  // Auto-init store if needed when this hook is used
  useEffect(() => {
    if (!isStoreReady) initStore();
  }, [isStoreReady, initStore]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const pendingSales = getPendingSales();
      if (pendingSales.length === 0) return [];

      console.log(`[Sync] Starting sync for ${pendingSales.length} items...`);
      const results = [];

      for (const sale of pendingSales) {
        // Double check it hasn't been synced by another process
        if (sale.status === 'SYNCED') continue;

        try {
          // 1. Mark as SYNCING (optimistic lock)
          await updateQueueItem(sale.id, { status: 'SYNCING' });

          // 2. Attempt API call
          const result = await processSaleApi(sale.data, locationId);

          // 3. Success!
          await updateQueueItem(sale.id, { status: 'SYNCED' });
          
          // Enterprise Choice: Do we keep history or clean up?
          // Cleaning up keeps the file size small.
          // Keeping it allows for "History" view even offline.
          // await removeFromQueue(sale.id); 
          
          results.push({ id: sale.id, success: true, data: result });
          
        } catch (error) {
          console.error(`[Sync] Failed to sync sale ${sale.id}:`, error);
          
          const errorMessage = (error as any)?.response?.data?.error || (error as Error).message;
          // const isNetwork = isNetworkError(error);

          // 4. Handle Failure
          await updateQueueItem(sale.id, { 
            status: 'FAILED', 
            retryCount: (sale.retryCount || 0) + 1,
            lastError: errorMessage
          });

          // Logic: If it's a 400 (Validation) error, it will likely NEVER succeed.
          // You might want to flag these differently so they don't block the queue forever.
          // For now, we just leave them as FAILED.
          
          results.push({ id: sale.id, success: false, error: errorMessage });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results?.filter(r => r.success).length || 0;
      const failCount = results?.filter(r => !r.success).length || 0;

      if (successCount > 0) {
        // toast.success(`Synced ${successCount} sales.`);
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
      
      if (failCount > 0) {
        // Optional: Notify user if silent sync failed for some items
        toast.warning(`${failCount} sales failed to sync. Check 'Pending Sales'.`);
      }
    },
  });

  return {
    syncSales: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    pendingCount: getPendingSales().length,
  };
};

// --- Order Creation Hook (Unchanged) ---
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