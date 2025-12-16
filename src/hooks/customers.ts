import { apiClient } from "@/lib/axios";
import { Customer } from "@/types"; 
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef, useMemo } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';
import { safeStoreSet } from "@/lib/utils";

// --- Constants ---
const STORE_FILENAME = 'dealio_data.bin';
const KEY_LAST_SYNC_TOKEN = 'dealio_customers_sync_token';
const KEY_CUSTOMERS_DATA = 'dealio_customers_data';
const SYNC_INTERVAL = 1000 * 60 * 60 * 2; // 2 Hours

// --- Types (Aligned with your Backend Response) ---

export interface PosCustomer extends Customer {
    updatedAt: string; // ISO string from JSON
    
    // New fields from your Backend logic
    customerType?: string | null;
    company?: string | null;
    businessAccountId?: string | null;
    loyaltyPoints?: number;
    
    // The calculated fields
    type: 'B2B' | 'B2C'; 
    primaryAddress: string | null;

    // Keep addresses if you still need the raw array
    addresses?: Array<{
        street1: string;
        city: string;
        postalCode: string;
    }>;
}

// Matches the return shape of `GET` / `getCustomersDelta`
interface CustomersSyncResponse {
    data: PosCustomer[];
    nextSyncToken: string; // The backend now returns this instead of just a timestamp
}

interface UsePosCustomersParams {
    search?: string;
    enabled?: boolean;
}

export const usePosCustomers = ({ search, enabled = true }: UsePosCustomersParams = {}) => {
    // Local State
    const [isStoreReady, setIsStoreReady] = useState(false);
    const [store, setStore] = useState<Store | null>(null);
    const [lastSyncToken, setLastSyncToken] = useState<string | null>(null);
    const [localCustomers, setLocalCustomers] = useState<PosCustomer[]>([]);
    
    const isProcessingRef = useRef(false);

    // 1. Initialize Tauri Store
    useEffect(() => {
        const initStore = async () => {
            try {
                const storeInstance = await load(STORE_FILENAME, { autoSave: true, defaults:{
                    [KEY_LAST_SYNC_TOKEN]: null,
                    [KEY_CUSTOMERS_DATA]: []
                }});
                const storedToken = await storeInstance.get<string>(KEY_LAST_SYNC_TOKEN);
                const storedData = await storeInstance.get<PosCustomer[]>(KEY_CUSTOMERS_DATA);

                setStore(storeInstance);
                setLastSyncToken(storedToken || null);
                
                // Ensure we set an array, even if store returns null/undefined
                if (Array.isArray(storedData)) {
                    setLocalCustomers(storedData);
                }
                
                setIsStoreReady(true);
            } catch (err) {
                console.error('Failed to load Tauri Store:', err);
                setIsStoreReady(true); // Proceed to allow fetch to try anyway
            }
        };
        initStore();
    }, []);

    // 2. React Query - The Sync Engine
    const { data: syncData, isFetching, refetch } = useQuery({
        queryKey: ['pos-customers-sync'],
        enabled: isStoreReady && enabled,
        queryFn: async () => {
            const params: any = {};

            // Align with backend: param is 'lastSync'
            if (lastSyncToken) {
                console.log("Fetching Customer DELTA since:", lastSyncToken);
                params.lastSync = lastSyncToken;
            } else {
                console.log("Fetching FULL Customer list...");
            }

            // Expecting: { data: [...], nextSyncToken: "..." }
            const { data } = await apiClient.get<CustomersSyncResponse>('/api/v1/pos/customers', { params });
            return data;
        },
        staleTime: SYNC_INTERVAL, 
        refetchInterval: SYNC_INTERVAL,
        refetchOnWindowFocus: false,
    });

    // 3. Process Sync (Merge Logic with Safety Checks)
    useEffect(() => {
        if (!syncData || !store || isProcessingRef.current) return;

        // Prevent infinite loops if token hasn't changed (and we have data)
        if (syncData.nextSyncToken === lastSyncToken && localCustomers.length > 0) return;

        const processCustomerSync = async () => {
            isProcessingRef.current = true;
            try {
                const currentCustomers = (await store.get<PosCustomer[]>(KEY_CUSTOMERS_DATA)) || [];
                const incomingCustomers = Array.isArray(syncData.data) ? syncData.data : [];
                
                let updatedList: PosCustomer[] = [];

                if (!lastSyncToken) {
                    // Full Sync: Replace entirely
                    updatedList = incomingCustomers;
                } else {
                    // Delta Sync: Merge
                    const customerMap = new Map(currentCustomers.map(c => [c.id, c]));
                    
                    // Backend returns active customers. If you need to handle Deletes in Delta sync, 
                    // your backend needs to return a separate `deletedIds` array. 
                    // For now, we update/insert the modified records:
                    incomingCustomers.forEach(c => {
                        customerMap.set(c.id, c);
                    });

                    updatedList = Array.from(customerMap.values());
                }

                // --- THE FIX IS HERE ---
                // 1. Ensure data is valid (never undefined)
                // 2. Use safeStoreSet to handle the writing
                
                console.log(`Saving ${updatedList.length} customers. Token: ${syncData.nextSyncToken}`);

                await safeStoreSet(store, KEY_CUSTOMERS_DATA, updatedList);
                await safeStoreSet(store, KEY_LAST_SYNC_TOKEN, syncData.nextSyncToken);
                
                await store.save(); // Persist to disk

                // Update React State
                setLocalCustomers(updatedList);
                setLastSyncToken(syncData.nextSyncToken);

            } catch (err) {
                console.error("Failed to save customers to store:", err);
            } finally {
                isProcessingRef.current = false;
            }
        };

        processCustomerSync();
    }, [syncData, store, lastSyncToken]);

    // 4. Local Filtering
    const filteredCustomers = useMemo(() => {
        let result = localCustomers;

        if (search) {
            const lowerSearch = search.toLowerCase();
            result = result.filter(c => 
                c.name.toLowerCase().includes(lowerSearch) ||
                (c.phone && c.phone.includes(lowerSearch)) ||
                (c.email && c.email.toLowerCase().includes(lowerSearch)) ||
                (c.company && c.company.toLowerCase().includes(lowerSearch))
            );
        }
        return result;
    }, [localCustomers, search]);

    return {
        customers: filteredCustomers,
        isSyncing: isFetching || !isStoreReady,
        triggerSync: refetch,
        totalCount: filteredCustomers.length
    };
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, any>({
    mutationFn: data => apiClient.post('/api/v1/pos/customers', data),
    onSuccess: () => {
      // Invalidate the sync query to trigger a refresh (or we could optimistically update local store)
      queryClient.invalidateQueries({ queryKey: ['pos-customers-sync'] });
      // Also invalidate legacy key if used elsewhere
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};