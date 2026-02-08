import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { API_ENDPOINT } from '@/lib/axios'; // Unused now
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
  totalStock?: number; // Added to match backend
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
    // Prevent refetching simply because the user clicked the window
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: enabled, 
    // Keep previous data visible while fetching new search results to prevent UI flash
    placeholderData: (prev) => prev,
  });

  // --- SYNC TO GLOBAL STORE ---
  // When we fetch "all" products (no search, no category filter), update the global store
  // so that features like Low Stock Alerts works.
  useEffect(() => {
    if (products.length > 0 && !debouncedSearch && category === 'all') {
        const mappedForStore = products.map(p => ({
             ...p,
             // Ensure optional fields required by Store Product interface are populated if needed
             // store.ts expects 'name' (optional) and 'productName' (required)
             // backend sends 'productName'.
             // We can just pass the mapped product since it now has 'stock'.
        }));
        setProducts(mappedForStore as any); // Cast as any if minor type mismatches exist, or align types perfectly.
    }
  }, [products, debouncedSearch, category, setProducts]);

  // --- MUTATION: Sync Logic ---
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("No Location ID");

      // CRITICAL: Ensure 'sync_products_command' is ASYNC in Rust
      // No args needed now, backend uses stored auth state
      const res = await invoke('sync_products_command', {});
      return res;
    },
    onSuccess: () => {
      // After syncing, invalidate the search cache so the new products appear immediately
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
    },
    onError: (err) => console.error("Sync Failed:", err)
  });

  // 3. REMOVED useEffect
  // We do NOT auto-trigger sync here. Auto-triggering causes the "API call on every render" issue.
  // Instead, we expose a stable trigger function.

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