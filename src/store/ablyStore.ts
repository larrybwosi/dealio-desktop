import { createWithEqualityFn as create } from 'zustand/traditional';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { isAxiosError } from 'axios';
import { AuthOptions, Realtime } from 'ably';
import { useAuthStore } from './pos-auth-store';

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
  client: Realtime | null;
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
    const authCallback: AuthOptions['authCallback'] = async (tokenParams, callback) => {
      try {
        console.log('Init call')
        const data = await invoke<any>('get_ably_auth_token_command', { params: tokenParams });
        console.log('Api response data', data)
        
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
    const client = new Realtime({
      authCallback, // SDK handles the loop now
      // Optional: autoConnect: false (if you want more control)
    });

    // Listen to connection state changes (Important for UI feedback and backend sync)
    client.connection.on((stateChange) => {
      const state = stateChange.current;
      set({ connectionState: state });

      // Notify backend about network status
      if (state === 'connected') {
        invoke('update_network_status_command', { isOnline: true }).catch(console.error);
        
        // Enter Presence
        const authStore = useAuthStore.getState();
        const locationId = authStore.currentLocation?.id;
        const member = authStore.currentMember;

        if (locationId && member) {
          const presenceChannel = client.channels.get(`presence:${locationId}`);
          presenceChannel.presence.enter({
            id: member.id,
            name: member.name,
            lastSeen: new Date().toISOString()
          }).catch(err => console.error("Error entering presence:", err));
        }
      } else if (['disconnected', 'suspended', 'failed', 'closed'].includes(state)) {
        invoke('update_network_status_command', { isOnline: false }).catch(console.error);
      }

      if (state === 'failed') {
          console.error("Ably connection failed");
      }
    });

    set({ client });
  },
}));