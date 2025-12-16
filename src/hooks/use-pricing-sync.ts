import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { load, Store } from "@tauri-apps/plugin-store";
import { apiClient } from "@/lib/axios";

// --- CONSTANTS ---
const STORE_FILENAME = "pos_data.bin";
const KEY_LAST_SYNC = "pos_pricing_last_sync";
const KEY_PRICING_DATA = "pos_pricing_data";

// --- TYPES (Simplified and Consolidated) ---

/**
 * Simplified PriceList object for client consumption.
 */
export interface ClientPriceList {
  id: string; // PriceList ID
  code: string;
  priority: number;
  isGlobal: boolean;
  isActive: boolean;
  validFrom: string | null; // ISO Date String
  validTo: string | null; // ISO Date String
  updatedAt: string; // ISO Date String
}

/**
 * Simplified PriceListItem object for client consumption.
 */
export interface ClientPriceListItem {
  id: string; // PriceListItem ID
  priceListId: string;
  variantId: string;
  /** ID of the VariantSellingUnit, or null if it applies to the Base Unit. */
  sellingUnitId: string | null;
  /** The minimum quantity for this price tier. */
  minQuantity: number;
  /** The Final Calculated Price (Cached). Stored as a Decimal string. */
  price: string;
  updatedAt: string;
}

/**
 * The full structure of the successful response from the Price Sync API.
 */
interface PricingSyncResponse {
  metadata: {
    syncedAt: string;
    isDelta: boolean;
  };
  data: {
    lists: ClientPriceList[];
    items: ClientPriceListItem[];
    customerAllocations: Record<string, string[]>;
    deletedItemIds: string[];
  };
}

// Interface for the data stored locally in Tauri Store
interface PosPricingData {
  lists: ClientPriceList[];
  items: ClientPriceListItem[];
  allocations: Record<string, string[]>;
}

// --- STORE UTILITY FUNCTIONS ---

/**
 * Initializes the Tauri Store and loads the initial sync time.
 * @returns A promise that resolves to the store instance and the last sync time.
 */
const initTauriStore = async (): Promise<{ store: Store; lastSync: string | null }> => {
  try {
    const storeInstance = await load(STORE_FILENAME, { autoSave: true, defaults: {} });
    const storedSyncTime = await storeInstance.get<string>(KEY_LAST_SYNC);
    
    return {
      store: storeInstance,
      lastSync: storedSyncTime || null,
    };
  } catch (err) {
    console.error("Failed to load Tauri Store:", err);
    throw new Error("Failed to initialize local data store.");
  }
};


/**
 * Processes the sync data (Full or Delta) and updates the local Tauri Store.
 * @param store The initialized Tauri Store instance.
 * @param syncData The data fetched from the API.
 * @param currentLastSync The current last sync time from state.
 */
const processAndSaveSyncData = async (
  store: Store,
  syncData: PricingSyncResponse,
  currentLastSync: string | null
): Promise<string | null> => {
  
  const { metadata, data } = syncData;

  // Idempotency: If we already synced this specific timestamp, stop.
  if (metadata.syncedAt === currentLastSync) {
    console.log("Sync data is already processed (timestamp matched).");
    return currentLastSync;
  }
  
  console.log(`Processing ${metadata.isDelta ? 'Delta' : 'Full'} Sync...`);

  try {
    let newData: PosPricingData;

    if (!metadata.isDelta) {
      // --- FULL SYNC (Overwrite) ---
      newData = {
        lists: data.lists,
        items: data.items,
        allocations: data.customerAllocations
      };
    } else {
      // --- DELTA SYNC (Merge) ---
      const currentData = (await store.get<PosPricingData>(KEY_PRICING_DATA)) || { 
        lists: [], items: [], allocations: {} 
      };

      // Use Maps for efficient O(1) merge operations
      const listMap = new Map<string, ClientPriceList>(currentData.lists.map(l => [l.id, l]));
      const itemMap = new Map<string, ClientPriceListItem>(currentData.items.map(i => [i.id, i]));
      
      // Merge customer allocations (new allocations overwrite old ones)
      const allocations = {...currentData.allocations, ...data.customerAllocations};

      // 1. Delete items
      data.deletedItemIds.forEach(id => itemMap.delete(id));

      // 2. Update/Add lists (New lists overwrite old ones by ID)
      data.lists.forEach(list => listMap.set(list.id, list));

      // 3. Update/Add items (New items overwrite old ones by ID)
      data.items.forEach(item => itemMap.set(item.id, item));
      
      newData = {
        lists: Array.from(listMap.values()),
        items: Array.from(itemMap.values()),
        allocations: allocations
      };
    }

    // Save the new pricing data
    await store.set(KEY_PRICING_DATA, newData);

    // Save the new timestamp and persist to disk
    const newTime = metadata.syncedAt;
    await store.set(KEY_LAST_SYNC, newTime);
    await store.save();

    console.log("Sync complete. Updated time to:", newTime);
    return newTime;

  } catch (err) {
    console.error("Failed to process and save to Tauri Store:", err);
    throw new Error("Local data processing failed.");
  }
};

// --- REACT HOOK ---

export const usePosPricingSync = () => {
  // State for Tauri Store management
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isStoreReady, setIsStoreReady] = useState(false);
  const [store, setStore] = useState<Store | null>(null);

  // Refs prevent dependency loops in useEffects/Callbacks
  const isProcessingRef = useRef(false);
  const lastSyncRef = useRef<string | null>(null);

  // 1. Initialize Tauri Store and load initial state
  useEffect(() => {
    initTauriStore()
      .then(({ store: storeInstance, lastSync: storedSyncTime }) => {
        setStore(storeInstance);
        setLastSync(storedSyncTime);
        lastSyncRef.current = storedSyncTime; // Sync Ref immediately
        setIsStoreReady(true);
      })
      .catch(() => {
        setIsStoreReady(true); 
      });
  }, []);

  // Use useCallback with empty deps. It reads from REF, not State.
  const fetchPricingData = useCallback(async () => {
    const currentSyncTime = lastSyncRef.current;

    if (!currentSyncTime) {
      console.log("No local data found. Fetching FULL DATA dump...");
      // 1. Full Dump Endpoint
      const response = await apiClient.get<PricingSyncResponse>("/api/v1/pos/pricing");
      return response.data;
    } else {
      console.log("Local data found. Fetching DELTA updates...");
      // 2. Sync/Delta Endpoint
      const params = { lastSync: currentSyncTime };
      const response = await apiClient.get<PricingSyncResponse>(
        "/api/v1/pos/pricing/sync",
        { params }
      );
      return response.data;
    }
  }, []); 

  // 2. React Query: Fetching and Caching Logic
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["posPricingSync"], // Fixed Key (Removed lastSync variable to prevent loop)
    enabled: isStoreReady, 
    queryFn: fetchPricingData,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
    refetchInterval: 1000 * 60 * 60 * 2, // Auto-refetch every 2 Hours
  });

  // 3. Process Sync (Merge Logic)
  useEffect(() => {
    // Guard clauses
    if (!data || !store || isProcessingRef.current) return;
    
    const runProcessing = async () => {
        // Double-check the ref before starting
        if (isProcessingRef.current) return; 
        
        isProcessingRef.current = true;
        try {
            // Pass the Ref's current value to the processor
            const newSyncTime = await processAndSaveSyncData(store, data, lastSyncRef.current);
            if (newSyncTime) {
              setLastSync(newSyncTime);
              lastSyncRef.current = newSyncTime; // Update ref for the next interval check
            }
        } catch (err) {
            // Error is logged inside the utility function
        } finally {
            isProcessingRef.current = false;
        }
    };

    runProcessing();
    
  }, [data, store]); // removed lastSync to break cycle

  // 4. Return Object
  const isSyncing = isLoading || isFetching || !isStoreReady || isProcessingRef.current;

  return {
    data: data?.data, // The raw sync data (lists, items, etc.) from the API
    metadata: data?.metadata, // Sync metadata (syncedAt, isDelta)
    isSyncing, // Comprehensive syncing status
    syncError: error,
    triggerSync: refetch,
    lastSyncTime: lastSync,
  };
};

// --- PRICING RESOLUTION HELPER ---

/**
 * Resolves the price for a specific product/variant/unit for a given customer
 * based on the cached pricing data.
 */
export const resolveCustomerPrice = (
  pricingData: { lists: ClientPriceList[]; items: ClientPriceListItem[]; customerAllocations: Record<string, string[]> } | undefined,
  customerId: string | undefined,
  variantId: string,
  unitId: string | null
): number | null => {
  if (!pricingData) return null;

  // 1. Identify applicable Price Lists
  const applicableListIds = new Set<string>();

  // a. Customer Specific Lists
  if (customerId && pricingData.customerAllocations && pricingData.customerAllocations[customerId]) {
    pricingData.customerAllocations[customerId].forEach(id => applicableListIds.add(id));
  }

  // b. Global Lists
  pricingData.lists.forEach(list => {
    if (list.isGlobal) {
      applicableListIds.add(list.id);
    }
  });

  if (applicableListIds.size === 0) return null;

  // 2. Filter and Sort Lists
  const now = new Date();
  const sortedLists = pricingData.lists
    .filter(list => {
      // Must be in applicable set
      if (!applicableListIds.has(list.id)) return false;
      
      // Must be active
      if (!list.isActive) return false;

      // Check validity dates
      if (list.validFrom && new Date(list.validFrom) > now) return false;
      if (list.validTo && new Date(list.validTo) < now) return false;

      return true;
    })
    .sort((a, b) => b.priority - a.priority); // Higher priority first

  // 3. Find the first matching price item
  for (const list of sortedLists) {
    const matchedItem = pricingData.items.find(item => 
      item.priceListId === list.id &&
      item.variantId === variantId &&
      (item.sellingUnitId === unitId || (item.sellingUnitId === null && unitId === null)) 
    );

    if (matchedItem) {
        return parseFloat(matchedItem.price);
    }
  }

  return null;
};