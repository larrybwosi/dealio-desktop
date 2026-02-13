import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/pos-auth-store';
import { usePosStore } from '@/store/store';
import { invoke } from '@tauri-apps/api/core';
import { useDebounce } from 'use-debounce';
import { useCallback, useEffect } from 'react';

// --- Types (Kept the same) ---
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
  totalStock?: number;
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
  const setProducts = usePosStore(state => state.setProducts);
  
  // 1. Selectors prevent unnecessary re-renders when other auth parts change
  const locationId = useAuthStore((state) => state.currentLocation?.id);

  // 2. Debounce the search input (500ms delay)
  const safeSearch = search || "";
  const [debouncedSearch] = useDebounce(safeSearch, 500);

  // --- QUERY: Local Search ---
  const { data: products = [], isLoading: isSearching } = useQuery({
    queryKey: ['pos-products', debouncedSearch, category, locationId], // Added locationId to force refetch on change
    queryFn: async () => {
      // Invoke Tauri command to search local DB
      const rawProducts = await invoke<PosProduct[]>('search_products_command', {
        query: debouncedSearch,
        category: category,
      });

      // Map backend totalStock to frontend stock
      return rawProducts.map(p => ({
        ...p,
        stock: p.stock ?? p.totalStock ?? 0 
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: enabled, 
    placeholderData: (prev) => prev,
  });

  // --- SYNC TO GLOBAL STORE ---
  // When we fetch "all" products (no search, no category filter), update the global store
  // so that features like Low Stock Alerts works.
  useEffect(() => {
    if (products.length > 0 && !debouncedSearch && category === 'all') {
        const mappedForStore = products.map(p => ({
             ...p,
        }));
        setProducts(mappedForStore as any);
    }
  }, [products, debouncedSearch, category, setProducts]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("No Location ID");

      const res = await invoke('sync_products_command', {});
      return res;
    },
    onSuccess: () => {
      // After syncing, invalidate the search cache so the new products appear immediately
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
    },
    onError: (err) => console.error("Sync Failed:", err)
  });

  const handleSync = useCallback(() => {
    if (enabled && locationId && !syncMutation.isPending) {
      syncMutation.mutate();
    }
  }, [enabled, locationId, syncMutation]);

  return {
    products,
    isLoading: isSearching && products.length === 0, // Only show loading on initial load
    isSyncing: syncMutation.isPending,
    triggerSync: handleSync, // Attach this to a "Sync" button or a "Pull to Refresh"
    totalCount: products.length,
    error: syncMutation.error
  };
}