import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { load, Store } from "@tauri-apps/plugin-store";
import { apiClient } from "@/lib/axios";

// Types
interface PricingSyncResponse {
  metadata: {
    syncedAt: string;
    isDelta: boolean;
  };
  data: {
    lists: any[];
    items: any[];
    customerAllocations: Record<string, string[]>;
    deletedItemIds: string[];
  };
}

const STORE_FILENAME = "pos_data.bin";
const KEY_LAST_SYNC = "pos_pricing_last_sync";
const KEY_PRICING_DATA = "pos_pricing_data";

export const usePosPricingSync = () => {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isStoreReady, setIsStoreReady] = useState(false);
  const [store, setStore] = useState<Store | null>(null);

  // Ref to track processing status to prevent double-execution
  const isProcessingRef = useRef(false);

  // 1. Initialize Tauri Store
  useEffect(() => {
    const initStore = async () => {
      try {
        const storeInstance = await load(STORE_FILENAME, { autoSave: true, defaults: {} });
        const storedSyncTime = await storeInstance.get<string>(KEY_LAST_SYNC);
        
        setStore(storeInstance);
        setLastSync(storedSyncTime || null);
        setIsStoreReady(true);
      } catch (err) {
        console.error("Failed to load Tauri Store:", err);
      }
    };
    initStore();
  }, []);

  // 2. React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["posPricingSync"], 
    enabled: isStoreReady, // Only run once we know if we have a lastSync time or not
    queryFn: async () => {
      // --- ROUTE SWITCHING LOGIC ---
      if (!lastSync) {
        console.log("No local data found. Fetching FULL DATA dump...");
        // 1. Full Dump Endpoint
        const response = await apiClient.get<PricingSyncResponse>("/api/v1/pos/pricing");
        return response.data;
      } else {
        console.log("Local data found. Fetching DELTA updates...");
        // 2. Sync/Delta Endpoint
        const params = { lastSync };
        const response = await apiClient.get<PricingSyncResponse>(
          "/api/v1/pos/pricing/sync",
          { params }
        );
        return response.data;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Process Sync (Merge Logic)
  useEffect(() => {
    // Guard clauses
    if (!data || !store || isProcessingRef.current) return;

    // Idempotency: If we already synced this specific timestamp, stop.
    if (data.metadata.syncedAt === lastSync) return;

    const processSync = async () => {
      isProcessingRef.current = true;
      console.log(`Processing ${data.metadata.isDelta ? 'Delta' : 'Full'} Sync...`);

      try {
        if (!data.metadata.isDelta) {
          // --- FULL SYNC (Overwrite) ---
          await store.set(KEY_PRICING_DATA, {
            lists: data.data.lists,
            items: data.data.items,
            allocations: data.data.customerAllocations
          });
        } else {
          // --- DELTA SYNC (Merge) ---
          const currentData = (await store.get<any>(KEY_PRICING_DATA)) || { 
            lists: [], items: [], allocations: {} 
          };

          // Remove deleted items
          const activeItems = currentData.items.filter(
            (item: any) => !data.data.deletedItemIds.includes(item.id)
          );

          // Merge new items (Append)
          const mergedLists = [...currentData.lists, ...data.data.lists]; 
          const mergedItems = [...activeItems, ...data.data.items];
          
          await store.set(KEY_PRICING_DATA, {
            lists: mergedLists,
            items: mergedItems,
            allocations: { ...currentData.allocations, ...data.data.customerAllocations }
          });
        }

        const newTime = data.metadata.syncedAt;
        
        // Save timestamp and persist
        await store.set(KEY_LAST_SYNC, newTime);
        await store.save();

        // Update local state
        setLastSync(newTime);
        console.log("Sync complete. Updated time to:", newTime);

      } catch (err) {
        console.error("Failed to save to Tauri Store:", err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    processSync();
    
  }, [data, store, lastSync]); 

  // 4. Return Object
  return {
    data: data?.data,
    metadata: data?.metadata,
    isSyncing: isLoading || isFetching || !isStoreReady,
    syncError: error,
    triggerSync: refetch,
    lastSyncTime: lastSync,
  };
};