import { invoke } from "@tauri-apps/api/core";
// import { useAuthStore } from "@/store/pos-auth-store";
import { API_ENDPOINT } from "@/lib/axios";
import { useMemo, useDeferredValue, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

// --- HOOKS ---

export const usePosPricingSync = () => {
  const queryClient = useQueryClient();
  
  
  // Get Auth & Config Data
  // const { deviceKey, memberToken } = useAuthStore(); // Unused

  const syncMutation = useMutation({
    mutationFn: async () => {
      // if (!apiEndpoint) throw new Error("API Endpoint not configured");
      if (!API_ENDPOINT) {
          console.warn("API Endpoint is missing, sending empty string to Rust for debugging.");
      }
      
      const result = await invoke("sync_pricing_command", {});
      return result;
    },
    onSuccess: (newTimestamp) => {
      console.log("Pricing Synced. New Timestamp:", newTimestamp);
      // Invalidate relevant queries if needed
      queryClient.invalidateQueries({ queryKey: ["pricing-batch"] });
    },
    onError: (error) => {
      console.error("Pricing Sync Failed:", error);
    }
  });

  return {
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
    triggerSync: syncMutation.mutateAsync,
    lastSyncTime: null, // We could fetch this from Rust if needed, but it's less critical now
  };
};

export const useBatchPricing = (
    items: { variantId: string; unitId: string | null; isBaseUnit: boolean }[],
    customerId?: string
) => {
    // Stabilize items reference to prevent unnecessary re-renders
    // Use a ref to cache the previous stable value
    const stableItemsRef = useRef<typeof items>([]);
    
    // Create a stable key for comparison
    const currentKey = useMemo(() => {
        if (items.length === 0) return '';
        return items.map(i => `${i.variantId}:${i.unitId}:${i.isBaseUnit}`).sort().join('|');
    }, [items]);
    
    // Only update the ref if the key actually changed
    const stableItems = useMemo(() => {
        const prevKey = stableItemsRef.current.length === 0 ? '' : 
            stableItemsRef.current.map(i => `${i.variantId}:${i.unitId}:${i.isBaseUnit}`).sort().join('|');
        
        if (prevKey !== currentKey) {
            stableItemsRef.current = items;
        }
        return stableItemsRef.current;
    }, [currentKey, items]);

    // Defer the items to prevent blocking the main thread during syncing
    const deferredItems = useDeferredValue(stableItems);
    
    // Use deferred key for the query
    const requestKey = useMemo(() => {
        if (deferredItems.length === 0) return '';
        return deferredItems.map(i => `${i.variantId}:${i.unitId}:${i.isBaseUnit}`).sort().join('|');
    }, [deferredItems]);

    const { data: priceMap, isLoading } = useQuery({
        queryKey: ["pricing-batch", customerId, requestKey],
        queryFn: async () => {
            if (deferredItems.length === 0) return {};

            const requests = deferredItems.map(item => ({
                variant_id: item.variantId,
                unit_id: item.unitId,
                is_base_unit: item.isBaseUnit
            }));
            
            // Rust returns Vec<Option<f64>> ordered by input
            const results = await invoke<Array<number | null>>("resolve_price_batch_command", {
                customerId,
                requests
            });

            // Map back to a lookup key
            const map: Record<string, number> = {};
            results.forEach((price, index) => {
                if (price !== null) {
                    const item = deferredItems[index];
                    // Key: "variantId:unitId" (unitId string or 'null')
                    // We need a stable key for lookup
                    const key = `${item.variantId}:${item.unitId ?? 'null'}`;
                    map[key] = price;
                }
            });
            return map;
        },
        enabled: deferredItems.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
        // Keep previous data while loading new prices - prevents flicker
        placeholderData: (previousData) => previousData,
    });

    return {
        priceMap: priceMap || {},
        isLoading
    };
};