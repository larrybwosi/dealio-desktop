import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/axios';

// API call function using axios
export const dispatchOrder = async (transactionId: string, payload: any) => {
  // Convert date to ISO string for the API if present
  const formattedPayload = {
    ...payload,
    estimatedTime: payload.estimatedTime ? payload.estimatedTime.toISOString() : undefined,
  };
  
  const response = await apiClient.post(
    `/api/v1/pos/deliveries/dispatch?transactionId=${transactionId}`, 
    formattedPayload
  );
  return response.data;
};

interface UseDispatchOrderMutationOptions {
  transactionId: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export function useDispatchOrderMutation({ 
  transactionId, 
  onSuccess, 
  onError 
}: UseDispatchOrderMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: any) => dispatchOrder(transactionId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Order Dispatched', {
        description: 'The delivery record has been created successfully.',
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Dispatch error:', error);
      toast.error('Error', {
        description: error.response?.data?.message || 'Could not dispatch order. Please try again.',
      });
      onError?.(error);
    },
  });
}


interface UseReconcileDeliveryMutationOptions {
  fulfillmentId: string | null;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export function useReconcileDeliveryMutation({ 
  fulfillmentId, 
  onSuccess, 
  onError 
}: UseReconcileDeliveryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      if (!fulfillmentId) {
        throw new Error("No fulfillment ID provided");
      }
      
      formData.append('fulfilmentId', fulfillmentId);
      return await apiClient.post('/api/v1/pos/deliveries/reconcile-pod', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success("Delivery reconciled successfully");
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Reconciliation error:', error);
      toast.error(error.response?.data?.error || "Reconciliation failed");
      onError?.(error);
    }
  });
}