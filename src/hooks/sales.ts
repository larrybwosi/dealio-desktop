import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; 
import { AxiosError, isAxiosError } from 'axios';
import { apiClient } from '@/lib/axios';
import { useOfflineSaleStore } from '@/store/offline-sale';
import z from 'zod/v3';
import { useAuthStore } from '@/store/pos-auth-store';

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

const kenyanPhoneRegex = /^(?:254|\+254|0)?(7(?:(?:[129][0-9])|(?:0[0-8])|(?:4[0-1]))[0-9]{6})$/;

export const ProcessSaleInputSchema = z
  .object({
    cartItems: z
      .array(
        z.object(
          {
            productId: z.string({ required_error: 'Product ID is required' }).min(1, 'Product ID cannot be empty'),
            variantId: z.string({ required_error: 'Variant ID is required' }).min(1, 'Variant ID cannot be empty'),
            quantity: z
              .number({
                required_error: 'Quantity is required',
                invalid_type_error: 'Quantity must be a number',
              })
              .int('Quantity must be a whole number')
              .positive('Quantity must be greater than zero'),
            sellingUnitId: z
              .string({ required_error: 'Selling unit ID is required' })
              .min(1, 'Selling unit ID cannot be empty'),
          },
          { required_error: 'Cart items are required' }
        )
      )
      .min(1, 'At least one cart item is required'),

    locationId: z.string({ required_error: 'Location ID is required' }).min(1, 'Location ID cannot be empty'),
    saleNumber: z.string().optional().nullable(),
    isWholesale: z.boolean().optional().default(false),

    customerId: z
      .string()
      .optional()
      .nullable()
      .refine(val => !val || val.length > 0, {
        message: 'Customer ID cannot be empty if provided',
      }),

    businessAccountId: z
      .string()
      .optional()
      .nullable()
      .refine(val => !val || val.length > 0, {
        message: 'Business Account ID cannot be empty if provided',
      }),

    // Payment Details
    paymentMethod: z.nativeEnum(PaymentMethod, {
      required_error: 'Payment method is required',
      invalid_type_error: 'Invalid payment method',
    }),

    paymentStatus: z.nativeEnum(PaymentStatus, {
      required_error: 'Payment status is required',
      invalid_type_error: 'Invalid payment status',
    }),

    // M-Pesa Specific
    mpesaPhoneNumber: z
      .string()
      .regex(kenyanPhoneRegex, 'Invalid Kenyan Phone Number')
      .transform(val => val.replace(/^\+/, '').replace(/^0/, '254')) // Normalize to 254
      .optional()
      .nullable(),

    amountReceived: z
      .number({
        invalid_type_error: 'Amount received must be a number',
      })
      .nonnegative('Amount received cannot be negative')
      .optional(),

    change: z
      .number({
        invalid_type_error: 'Change amount must be a number',
      })
      .nonnegative('Change amount cannot be negative')
      .optional(),

    discountAmount: z
      .number({
        invalid_type_error: 'Discount amount must be a number',
      })
      .nonnegative('Discount amount cannot be negative')
      .default(0)
      .nullable(),

    cashDrawerId: z
      .string()
      .optional()
      .nullable()
      .refine(val => !val || val.length > 0, {
        message: 'Cash drawer ID cannot be empty if provided',
      }),

    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),

    enableStockTracking: z.boolean({
      required_error: 'Stock tracking preference is required',
      invalid_type_error: 'Stock tracking must be a boolean',
    }),

    taxIds: z
      .array(z.string().min(1, 'Tax ID cannot be empty'), {
        invalid_type_error: 'Tax IDs must be an array of strings',
      })
      .optional(),

    saleDate: z
      .date({
        required_error: 'Sale date is required',
        invalid_type_error: 'Invalid date format',
      })
      .max(new Date(), 'Sale date cannot be in the future')
      .optional(),
  })
  // Refinement 1: Require Phone Number if M-Pesa
  .refine(
    data => {
      if (data.paymentMethod === 'MPESA') {
        return !!data.mpesaPhoneNumber;
      }
      return true;
    },
    {
      message: 'Phone number is required for M-Pesa payments',
      path: ['mpesaPhoneNumber'],
    }
  )
  // Refinement 2: Validate Amount Received rules
  .refine(
    data => {
      // If M-Pesa, we expect an amount to push, even if status is pending
      if (data.paymentMethod === 'MPESA') {
        return data.amountReceived !== undefined && data.amountReceived !== null && data.amountReceived > 0;
      }
      // Existing logic for other methods
      if (data.paymentStatus !== 'PENDING' && data.paymentMethod !== 'CREDIT') {
        return data.amountReceived !== undefined && data.amountReceived !== null;
      }
      return true;
    },
    {
      message: 'Amount to charge is required',
      path: ['amountReceived'],
    }
  )
  // Refinement 3: Validate that amount covers the total for cash payments
  .refine(
    data => {
      if (data.paymentMethod === 'CASH' && data.paymentStatus === 'COMPLETED') {
        return (
          data.amountReceived !== undefined &&
          data.amountReceived !== null &&
          data.change !== undefined &&
          data.change !== null
        );
      }
      return true;
    },
    {
      message: 'Both amount received and change must be provided for cash payments',
      path: ['amountReceived'],
    }
  );

export type ProcessSaleInput = z.infer<typeof ProcessSaleInputSchema>;
