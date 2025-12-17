'use client';
import { useEffect } from 'react';
import { useAblyStore } from '@/store/ablyStore';

export default function AblyInitializer() {
  const initializeAbly = useAblyStore((state) => state.initializeAbly);
  const status = useAblyStore((state) => state.status);

  useEffect(() => {
    initializeAbly();
    
    return () => { 
      useAblyStore.getState().client?.close(); 
    }
  }, [initializeAbly]);

  if (status === 'error') return <div>Connection Failed</div>;
  
  return null;
}