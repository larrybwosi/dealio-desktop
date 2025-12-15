import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef, useMemo } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/pos-auth-store';

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

interface ProductsSyncResponse {
  products: PosProduct[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
  syncTimestamp?: string; // Returned by the delta backend
}

interface UsePosProductsParams {
  search: string;
  category: string;
  enabled?: boolean;
}

// --- Constants ---
const STORE_FILENAME = 'pos_data.bin';
const KEY_LAST_SYNC_PRODUCTS = 'pos_products_last_sync';
const KEY_PRODUCTS_DATA = 'pos_products_data';

export function usePosProducts({ search, category, enabled = true }: UsePosProductsParams) {
  const { currentLocation } = useAuthStore();
  const locationId = currentLocation?.id;

  // Local State
  const [isStoreReady, setIsStoreReady] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  // We keep a local copy in memory for fast filtering after sync
  const [localProducts, setLocalProducts] = useState<PosProduct[]>([]);
  
  const isProcessingRef = useRef(false);

  // 1. Initialize Tauri Store
  useEffect(() => {
    const initStore = async () => {
      if (!locationId) return;
      try {
        const storeInstance = await load(STORE_FILENAME, { autoSave: true, defaults: {} });
        const storedSyncTime = await storeInstance.get<string>(`${KEY_LAST_SYNC_PRODUCTS}_${locationId}`);
        const storedData = await storeInstance.get<PosProduct[]>(`${KEY_PRODUCTS_DATA}_${locationId}`);

        setStore(storeInstance);
        setLastSync(storedSyncTime || null);
        if (storedData) {
          setLocalProducts(storedData);
        }
        setIsStoreReady(true);
      } catch (err) {
        console.error('Failed to load Tauri Store for Products:', err);
      }
    };
    initStore();
  }, [locationId]);

  // 2. React Query - The Sync Engine
  const { data: syncData, isFetching, refetch } = useQuery({
    queryKey: ['pos-products-sync', locationId],
    enabled: isStoreReady && !!locationId && enabled,
    queryFn: async () => {
      // If we have a lastSync time, we use the delta endpoint (or pass the param)
      const params: any = {
        locationId: locationId!,
        page: '1',
        limit: '1000', 
        categoryId: 'all', 
        search: '', 
      };

      if (lastSync) {
        console.log("Fetching Product DELTA since:", lastSync);
        params.lastSync = lastSync;
      } else {
        console.log("Fetching FULL Product list...");
      }

      const { data } = await apiClient.get<ProductsSyncResponse>('/api/v1/pos/products', {
        params,
      });
      return data;
    },
    // --- OPTIMIZATION START ---
    // 1 hour in milliseconds
    staleTime: 1000 * 60 * 60, 
    // Auto-fetch in background every 1 hour
    refetchInterval: 1000 * 60 * 60, 
    // Prevent fetching on window focus (switching tabs)
    refetchOnWindowFocus: false,
    // Prevent fetching when component mounts if data is fresh (within 1 hour)
    refetchOnMount: false, 
    // Prevent fetching on network reconnect
    refetchOnReconnect: false,
    // --- OPTIMIZATION END ---
  });

  // 3. Process Sync (Merge Logic)
  useEffect(() => {
    if (!syncData || !store || !locationId || isProcessingRef.current) return;

    // Avoid reprocessing if the timestamp matches
    if (syncData.syncTimestamp && syncData.syncTimestamp === lastSync) return;

    const processProductSync = async () => {
      isProcessingRef.current = true;
      try {
        const currentProducts = (await store.get<PosProduct[]>(`${KEY_PRODUCTS_DATA}_${locationId}`)) || [];
        
        let updatedList: PosProduct[] = [];

        if (!lastSync) {
          // A. Full Sync 
          updatedList = syncData.products;
        } else {
          // B. Delta Sync (Merge)
          const productMap = new Map(currentProducts.map(p => [p.productId, p]));

          syncData.products.forEach(p => {
            productMap.set(p.productId, p);
          });

          updatedList = Array.from(productMap.values());
        }

        // Save to Store
        await store.set(`${KEY_PRODUCTS_DATA}_${locationId}`, updatedList);
        
        // Update Timestamp
        const newTime = syncData.syncTimestamp || new Date().toISOString();
        await store.set(`${KEY_LAST_SYNC_PRODUCTS}_${locationId}`, newTime);
        await store.save();

        // Update State
        setLocalProducts(updatedList);
        setLastSync(newTime);
        console.log(`Product Sync Complete. Items: ${updatedList.length}`);

      } catch (err) {
        console.error("Failed to save products to store:", err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    processProductSync();
  }, [syncData, store, locationId, lastSync]);

  // 4. Local Filtering
  const filteredProducts = useMemo(() => {
    let result = localProducts;

    if (category && category !== 'all') {
      result = result.filter(p => p.category === category);
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(p => 
        p.productName.toLowerCase().includes(lowerSearch) ||
        p.sku.toLowerCase().includes(lowerSearch) ||
        p.barcode?.toLowerCase().includes(lowerSearch) ||
        p.variants.some(v => v.barcode?.toLowerCase().includes(lowerSearch))
      );
    }

    return result;
  }, [localProducts, search, category]);

  return {
    products: filteredProducts,
    isSyncing: isFetching || !isStoreReady,
    // This allows the user to manually trigger a sync via a UI button
    triggerSync: refetch, 
    totalCount: filteredProducts.length,
    fetchNextPage: () => {}, 
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}