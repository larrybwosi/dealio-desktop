import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

// --- 1. Define Types Matching Your Backend Return Structure ---

export interface SellableUnit {
  unitId: string;
  unitName: string;
  price: number;
  conversion: number;
  isBaseUnit: boolean;
}

export interface PosProduct {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string; // e.g. "500ml"
  category: string;
  sku: string;
  barcode?: string;
  imageUrl?: string;
  stock: number;
  sellableUnits: SellableUnit[];
}

interface ApiError {
  error: string;
}

interface UsePosProductsParams {
  enabled?: boolean;
}

export const usePosProducts = ({ enabled = true }: UsePosProductsParams = {}) => {
  const { currentLocation } = useAuthStore();

  // Ensure we have a location ID before fetching
  const isQueryEnabled = enabled && !!currentLocation?.id;

  return useQuery<PosProduct[], AxiosError<ApiError>>({
    queryKey: ['pos-products'],
    queryFn: async (): Promise<PosProduct[]> => {
      if (!currentLocation?.id) throw new Error('No location selected');

      const { data } = await apiClient.get<PosProduct[]>('/api/v1/pos/products', {
        params: {
          locationId: currentLocation.id,
        },
      });
      return data;
    },
    enabled: isQueryEnabled,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });
};
