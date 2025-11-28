import { Realtime } from 'ably';
import { apiClient } from './axios';

// Alternative: Direct instance with client-side check
let ablyRealtimeInstance: Realtime | null = null;

export const getAblyRealtime = (): Realtime | null => {
  // Return null during server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }

  // Create instance only once on the client
  if (!ablyRealtimeInstance) {
    try {
      ablyRealtimeInstance = new Realtime({
        authCallback: async (tokenParams, callback) => {
          try {
            const tokenRequest = await apiClient.post(
              `/api/v1/pos/ably-auth`,
              {},
              { withCredentials: true }
            );
            callback(null, tokenRequest.data);
          } catch (err: any) {
            console.error('Error fetching Ably token:', err);
            callback(err, null);
          }
        },
        logLevel: 1,
      });
    } catch (err) {
      console.error('Error creating Ably realtime instance:', err);
    }
  }

  return ablyRealtimeInstance;
};

// For backward compatibility - returns null on server
export const ably = typeof window !== 'undefined' ? getAblyRealtime() : null;
