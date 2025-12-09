import { apiClient } from "@/lib/axios";
import { Customer } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, any>({
    mutationFn: data => apiClient.post('/api/v1/pos/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};