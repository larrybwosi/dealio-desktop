import { createWithEqualityFn as create } from 'zustand/traditional';
import { z } from 'zod';
import * as Ably from 'ably';
import { apiClient } from '@/lib/axios';
import { isAxiosError } from 'axios';

const AblyConfigSchema = z.object({
  tokenRequest: z.object({
    token: z.string(),
  }).loose(),
  metadata: z.object({
    paymentChannel: z.string(),
    organizationId: z.string().optional(),
  }),
});

interface AblyState {
  client: Ably.Realtime | null;
  paymentChannel: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  connectionState: string; // Track actual Ably connection state
  error: string | null;
  initializeAbly: () => void;
}

export const useAblyStore = create<AblyState>((set, get) => ({
  client: null,
  paymentChannel: null,
  status: 'idle',
  connectionState: 'closed',
  error: null,

  initializeAbly: () => {
    // Prevent multiple initializations
    if (get().client) return; 

    set({ status: 'loading' });

    // We define the authCallback logic here
    const authCallback: Ably.AuthOptions['authCallback'] = async (tokenParams, callback) => {
      try {
        const { data } = await apiClient.post('/api/v1/pos/ably-auth');
        console.log(data)
        
        // Validate
        const parsedData = AblyConfigSchema.parse(data);

        // Update metadata in store (this runs on every token refresh)
        set({ 
          paymentChannel: parsedData.metadata.paymentChannel,
          status: 'success', 
          error: null 
        });

        // Pass the token details back to Ably SDK
        // We pass the whole object (or just the token string if that's what you have)
        callback(null, parsedData.tokenRequest.token);
      } catch (error) {
        const errorMessage = isAxiosError(error)
          ? error.response?.data?.message || error.message
          : 'Failed to fetch Ably config';
        
        console.error('Ably Auth Error:', error);
        set({ status: 'error', error: errorMessage });
        callback(errorMessage, null);
      }
    };

    // Initialize Client with authCallback
    const client = new Ably.Realtime({
      authCallback, // SDK handles the loop now
      // Optional: autoConnect: false (if you want more control)
    });

    // Listen to connection state changes (Important for UI feedback)
    client.connection.on((stateChange) => {
      set({ connectionState: stateChange.current });
      if (stateChange.current === 'failed') {
          console.error("Ably connection failed");
      }
    });

    set({ client });
  },
}));