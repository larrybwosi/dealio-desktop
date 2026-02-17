'use client';
import { useEffect } from 'react';
import { useAblyStore } from '@/store/ablyStore';
import { useAuthStore } from '@/store/pos-auth-store';

export default function AblyInitializer() {
  const initializeAbly = useAblyStore((state) => state.initializeAbly);
  const client = useAblyStore((state) => state.client);
  const currentLocation = useAuthStore((state) => state.currentLocation);
  const currentMember = useAuthStore((state) => state.currentMember);

  const isAuthInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    // Only initialize Ably if auth is ready and we have a member
    // This prevents "Unauthorized" errors or race conditions on boot
    if (isAuthInitialized && currentMember) {
      console.log('[AblyProvider] Auth ready, initializing Ably');
      initializeAbly();
    }
  }, [initializeAbly, isAuthInitialized, currentMember]);

  useEffect(() => {
    if (!client || !currentLocation?.id || !currentMember) return;

    const presenceChannel = client.channels.get(`presence:${currentLocation.id}`);
    
    // Enter presence for this location
    presenceChannel.presence.enter({
      id: currentMember.id,
      name: currentMember.name,
      updatedAt: new Date().toISOString()
    }).catch(console.error);

    return () => {
      // Leave presence when location/member changes or unmount
      presenceChannel.presence.leave().catch(console.error);
    }
  }, [client, currentLocation?.id, currentMember]);

  useEffect(() => {
    return () => { 
      useAblyStore.getState().client?.close(); 
    }
  }, []);
  
  return null;
}