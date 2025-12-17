import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINT } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { invoke } from '@tauri-apps/api/core';

// --- Types ---

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
  updatedAt?: string; 
}

export interface PosProduct {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  category: string;
  sku: string;
  barcode?: string;
  imageUrl?: string;
  stock: number;
  sellableUnits: SellableUnit[];
  variants: Variant[];
  updatedAt?: string;
}

interface UsePosProductsParams {
  search: string;
  category: string;
  enabled?: boolean;
}

export function usePosProducts({ search, category, enabled = true }: UsePosProductsParams) {
  const queryClient = useQueryClient();
  
  // 1. Get Auth Data from Store
  const { currentLocation, deviceKey, memberToken } = useAuthStore();
  const locationId = currentLocation?.id;

  // 2. Query: Search Local Rust Memory (Fast)
  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', search, category],
    queryFn: async () => {
      // Rust command matches 'search_products_command' in lib.rs
      return await invoke<PosProduct[]>('search_products_command', {
        query: search,
        category: category,
      });
    },
    staleTime: 0, 
    placeholderData: (prev) => prev, // Keeps list stable while typing
  });

  // 3. Mutation: Trigger Sync
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("No Location ID");

      console.log("Creating Rust Sync Command...");
      
      // Rust command matches 'sync_products_command' in lib.rs
      // Note: We pass the raw API_ENDPOINT, Rust will append /api/v1...
      return await invoke('sync_products_command', {
        baseUrl: API_ENDPOINT, 
        locationId,
        deviceKey,    // Pass the Device Key
        memberToken   // Pass the Member Token
      });
    },
    onSuccess: (message) => {
      console.log("Rust Sync Success:", message);
      // Invalidate to refresh the local search results with new data
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
    },
    onError: (err) => {
      console.error("Rust Sync Failed:", err);
    }
  });

  // 4. Background Sync (Every hour)
  useQuery({
    queryKey: ['auto-sync-trigger', locationId],
    enabled: !!locationId && !!deviceKey && enabled,
    queryFn: async () => {
      await syncMutation.mutateAsync();
      return true;
    },
    refetchInterval: 1000 * 60 * 60, // 1 Hour
    refetchOnWindowFocus: false,
    retry: false
  });

  return {
    products,
    isSyncing: syncMutation.isPending,
    triggerSync: syncMutation.mutate,
    totalCount: products.length,
    // Add pagination stubs if your UI expects them, 
    // though searching usually negates traditional page numbers
    fetchNextPage: () => {}, 
    hasNextPage: false,
  };
}