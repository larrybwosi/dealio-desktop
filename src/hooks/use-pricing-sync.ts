import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/store/pos-auth-store";
import { API_ENDPOINT } from "@/lib/axios";

// --- HOOKS ---

export const usePosPricingSync = () => {
  const queryClient = useQueryClient();
  
  // Get Auth & Config Data
  const { deviceKey, memberToken } = useAuthStore();

  const syncMutation = useMutation({
    mutationFn: async () => {
      // if (!apiEndpoint) throw new Error("API Endpoint not configured");
      if (!API_ENDPOINT) {
          console.warn("API Endpoint is missing, sending empty string to Rust for debugging.");
      }
      
      const result = await invoke("sync_pricing_command", {
        baseUrl: API_ENDPOINT,
        deviceKey,
        memberToken
      });
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
    // Generate a consistent key for the request items to prevent unnecessary re-fetches
    const requestKey = JSON.stringify(items.map(i => `${i.variantId}:${i.unitId}:${i.isBaseUnit}`).sort());

    const { data: priceMap, isLoading } = useQuery({
        queryKey: ["pricing-batch", customerId, requestKey],
        queryFn: async () => {
            if (items.length === 0) return {};

            const requests = items.map(item => ({
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
                    const item = items[index];
                    // Key: "variantId:unitId" (unitId string or 'null')
                    // We need a stable key for lookup
                    const key = `${item.variantId}:${item.unitId ?? 'null'}`;
                    map[key] = price;
                }
            });
            return map;
        },
        enabled: items.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        priceMap: priceMap || {},
        isLoading
    };
};