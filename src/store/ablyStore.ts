// store/ablyStore.ts
import { createWithEqualityFn as create } from 'zustand/traditional';
import { z } from 'zod';
import * as Ably from 'ably';
import { apiClient } from '@/lib/axios';
import { isAxiosError } from 'axios';

// 1. Define Zod Schema for your API Response
const AblyConfigSchema = z.object({
  tokenRequest: z.object({
    token: z.string(),
    // Add other token fields if needed
  }).passthrough(), // Allow other fields in tokenRequest
  metadata: z.object({
    paymentChannel: z.string(),
    organizationId: z.string().optional(),
  }),
});

interface AblyState {
  client: Ably.Realtime | null;
  paymentChannel: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  fetchAblyConfig: () => Promise<void>;
}

export const useAblyStore = create<AblyState>((set, get) => ({
  client: null,
  paymentChannel: null,
  status: 'idle',
  error: null,

  fetchAblyConfig: async () => {
    // Prevent double-fetching if already loading or success
    if (get().status === 'loading' || get().status === 'success') return;

    set({ status: 'loading', error: null });

    try {
      const { data } = await apiClient.post('/api/v1/pos/ably-auth');
      console.log('Ably Config Data:', data);

      // 2. Validate response with Zod
      // This ensures your app crashes early/safely if the API changes unexpectedly
      const parsedData = AblyConfigSchema.parse(data);

      const client = new Ably.Realtime({
        token: parsedData.tokenRequest.token
      });

      set({
        client,
        paymentChannel: parsedData.metadata.paymentChannel,
        status: 'success',
        error: null,
      });
    } catch (error) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Failed to fetch Ably config';
      
      console.error('Ably Config Error:', error);
      set({ 
        status: 'error',
        error: errorMessage,
      });
    }
  },
}));