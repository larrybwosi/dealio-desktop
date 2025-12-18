import { useMutation, useQuery } from '@tanstack/react-query';
import { API_ENDPOINT } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';

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

// ... imports

export function usePosProducts({ search, category, enabled = true }: UsePosProductsParams) {
  const { currentLocation, deviceKey, memberToken } = useAuthStore();
  const locationId = currentLocation?.id;

  // 1. Search Query (Keep this as is, but ensure search is a string)
  // Default search to "" to prevent Rust serialization errors if undefined
  const safeSearch = search || ""; 
  
  const { data: products = [], isLoading: isSearching } = useQuery({
    queryKey: ['pos-products', safeSearch, category],
    queryFn: async () => {
      return await invoke<PosProduct[]>('search_products_command', {
        query: safeSearch,
        category: category,
      });
    },
    staleTime: 0, 
    placeholderData: (prev) => prev,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) {
        console.error("STOPPING: No Location ID found");
        throw new Error("No Location ID");
      }
      
      const payload = {
      baseUrl: API_ENDPOINT,
      locationId: locationId,
      deviceKey: deviceKey ?? null,     // MUST be null if missing
      memberToken: memberToken ?? null  // MUST be null if missing
    };

    // console.log("Sending Payload to Rust:", payload);

    // 2. Invoke with the clean payload
    const res = await invoke('sync_products_command', payload);
    // console.log("RUST RESPONSE:", res);
    return res;
    },
    onError: (err) => console.error("INVOKE FAILED:", err)
  });

  useEffect(() => {
    if (enabled && locationId && deviceKey) {
      syncMutation.mutate();
    } else {
        console.log("SKIPPING SYNC: Missing requirements");
    }
  }, [locationId, deviceKey, enabled]);

  // 4. OPTIONAL: Background Interval (If you still want hourly sync)
  useEffect(() => {
    if (!enabled || !locationId) return;
    const interval = setInterval(() => {
      syncMutation.mutate();
    }, 1000 * 60 * 60); // 1 Hour
    return () => clearInterval(interval);
  }, [enabled, locationId]);

  return {
    products,
    // Combine loading states so the UI knows if we are "initially loading"
    // or just "syncing in background"
    isLoading: isSearching && products.length === 0, 
    isSyncing: syncMutation.isPending,
    triggerSync: syncMutation.mutate,
    totalCount: products.length,
  };
}