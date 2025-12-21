import { useMutation, useQuery } from '@tanstack/react-query';
import { API_ENDPOINT } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

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
  sellableUnits: SellableUnit[];
  variants: Variant[];
  updatedAt?: string;
}

interface UsePosProductsParams {
  search: string;
  category: string;
  enabled?: boolean;
}

// --- Helper Hook: useDebounce ---
// Prevents value from updating until 'delay' ms has passed without changes
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function usePosProducts({ search, category, enabled = true }: UsePosProductsParams) {
  // 1. Optimization: Use Selectors
  // Using destructuring like `const { currentLocation } = useAuthStore()` subscribes 
  // to the WHOLE store. If *anything* in the store changes, this hook rerenders.
  // Using selectors ensures we only rerender when these specific values change.
  const locationId = useAuthStore((state) => state.currentLocation?.id);
  const deviceKey = useAuthStore((state) => state.deviceKey);
  const memberToken = useAuthStore((state) => state.memberToken);

  // 2. Fix: Debounce the search input
  // We delay updating the query key by 500ms to allow typing to finish
  const safeSearch = search || "";
  const debouncedSearch = useDebounce(safeSearch, 500);

  const { data: products = [], isLoading: isSearching } = useQuery({
    // 3. Fix: Use debouncedSearch in the key
    // The query will only refetch when the *debounced* value changes
    queryKey: ['pos-products', debouncedSearch, category],
    queryFn: async () => {
      // Note: We still use debouncedSearch here to ensure consistency
      return await invoke<PosProduct[]>('search_products_command', {
        query: debouncedSearch,
        category: category,
      });
    },
    // 4. Fix: Increase staleTime
    // Prevents refetching immediately on window focus or casual interaction.
    // Set to 1 minute (or appropriate time for your POS needs)
    staleTime: 1000 * 60, 
    placeholderData: (prev) => prev,
    // Only run query if hook is enabled
    enabled: enabled,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) {
        throw new Error("No Location ID");
      }
      
      const payload = {
        baseUrl: API_ENDPOINT,
        locationId: locationId,
        deviceKey: deviceKey ?? null,
        memberToken: memberToken ?? null
      };

      const res = await invoke('sync_products_command', payload);
      console.log("RUST RESPONSE:", res);
      return res;
    },
    onError: (err) => console.error("INVOKE FAILED:", err)
  });

  useEffect(() => {
    // Check strict requirements before syncing
    if (enabled && locationId && deviceKey) {
      syncMutation.mutate();
    }
    // Note: We exclude 'syncMutation' from deps to prevent loops if the mutation object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, deviceKey, enabled]);

  return {
    products,
    // Show loading only if we are searching and have no data yet
    isLoading: isSearching && products.length === 0, 
    isSyncing: syncMutation.isPending,
    triggerSync: syncMutation.mutate,
    totalCount: products.length,
  };
}