import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

// --- 1. Define Types Matching Your Backend Return Structure ---

export interface SellableUnit {
  unitId: string;
  unitName: string;
  price: number;
  conversion: number;
  isBaseUnit: boolean;
}

export interface Variant {
  variantId: string;
  variantName: string;
  barcode: string;
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
  variants: Variant[];
}

// Add pagination metadata interface
interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
}

// Add API response interface
interface ProductsResponse {
  products: PosProduct[];
  pagination: PaginationInfo;
}

interface ApiError {
  error: string;
}

interface UsePosProductsParams {
  search: string;
  category: string;
  enabled?: boolean;
}

export function usePosProducts({ search, category, enabled = true }: UsePosProductsParams) {
  const { currentLocation } = useAuthStore();
  
  if (!currentLocation?.id) {
    throw new Error('No location selected');
  }

  const locationId = currentLocation.id;

  return useInfiniteQuery({
    queryKey: ['pos-products', category, search],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        locationId: locationId,
        page: pageParam.toString(),
        limit: '20', // Fetch 20 at a time for speed
        search,
        categoryId: category,
      });

      const { data } = await apiClient.get<ProductsResponse>('/api/v1/pos/products', {
        params: params,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: ProductsResponse) => {
      // Check if there are more pages based on the pagination metadata
      if (lastPage.pagination.page < lastPage.pagination.pages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    retry: (failureCount: number, error: AxiosError<ApiError>) => {
      // Don't retry on 4xx errors (client errors)
      if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    enabled: !!locationId && enabled,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}