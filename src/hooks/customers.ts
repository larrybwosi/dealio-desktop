import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/pos-auth-store';
import { API_ENDPOINT } from '@/lib/axios';
import { apiClient } from "@/lib/axios";
import { Customer } from "@/types";

// Types match the Rust JSON output (camelCase)
export interface PosCustomer extends Customer {
    id: string;
    name: string;
    email?: string; // rust Option -> string | null/undefined
    phone?: string;
    customerType?: string;
    company?: string;
    primaryAddress?: string;
    updatedAt: string;
}

interface UsePosCustomersParams {
    search?: string;
    enabled?: boolean;
}

export const usePosCustomers = ({ search, enabled = true }: UsePosCustomersParams = {}) => {
    const { currentLocation, deviceKey, memberToken } = useAuthStore();
    const locationId = currentLocation?.id;
    const queryClient = useQueryClient();

    // 1. Search Query - Fetches from Rust Memory (Fast)
    const safeSearch = search || "";

    const { data: customers = [], isLoading: isSearching } = useQuery({
        queryKey: ['pos-customers', safeSearch],
        queryFn: async () => {
            return await invoke<PosCustomer[]>('search_customers_command', {
                query: safeSearch,
            });
        },
        // Keep data while searching to avoid flickering
        placeholderData: (prev) => prev,
        staleTime: 1000 * 60 * 5, // Consider local data fresh for 5 mins
    });

    // 2. Sync Mutation - Triggers Rust Background Sync
    const syncMutation = useMutation({
        mutationFn: async () => {
            if (!locationId) throw new Error("No Location ID");

            const payload = {
                baseUrl: API_ENDPOINT,
                locationId: locationId,
                deviceKey: deviceKey ?? null,
                memberToken: memberToken ?? null
            };

            console.log("Syncing Customers...");
            const res = await invoke('sync_customers_command', payload);
            console.log("Sync Result:", res);
            return res;
        },
        onSuccess: () => {
            // After sync, invalidate the search query so the UI updates with new data
            queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
        },
        onError: (err) => console.error("Customer Sync Failed:", err)
    });

    // 3. Auto-Sync on Mount / Auth Change
    useEffect(() => {
        if (enabled && locationId && deviceKey) {
            syncMutation.mutate();
        }
    }, [locationId, deviceKey, enabled]);

    // 4. Background Sync Interval (e.g., every 30 mins)
    useEffect(() => {
        if (!enabled || !locationId) return;
        const interval = setInterval(() => {
            syncMutation.mutate();
        }, 1000 * 60 * 30); 
        return () => clearInterval(interval);
    }, [enabled, locationId]);

    return {
        customers,
        isSyncing: syncMutation.isPending,
        triggerSync: syncMutation.mutate,
        totalCount: customers.length
    };
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, any>({
    mutationFn: data => apiClient.post('/api/v1/pos/customers', data),
    onSuccess: () => {
      // After creating online, trigger a local sync immediately
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      // Note: You might want to manually call syncMutation.mutate() here if you can access it,
      // or rely on the backend sending the new customer in the next sync interval.
    },
  });
};