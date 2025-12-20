import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useScannerStore } from '@/store/barcode-scanner';

interface ScanPayload {
  message: string;
}

export const useScanner = () => {
  const store = useScannerStore();
  
  // Track if the component is mounted to prevent state updates on unmount
  const isMounted = useRef(false);
  // Store unlisten functions in a generic array for easier cleanup
  const unlisteners = useRef<UnlistenFn[]>([]);

  const startScanner = async () => {
    if (store.isScanning) return;
    
    // Validation
    if (!store.vid || !store.pid) {
      store.setError("Vendor ID and Product ID are missing.");
      return; 
    }

    store.setError(null);

    try {
      // 1. Setup Listeners
      const unlistenData = await listen<ScanPayload>('scanner-data', (event) => {
        console.log('Barcode Received:', event.payload.message);
        store.addScannedItem(event.payload.message);
      });
      unlisteners.current.push(unlistenData);

      const unlistenStatus = await listen<string>('scanner-status', (event) => {
        const status = event.payload;
        if (status === 'Connected') store.setIsConnected(true);
        if (status === 'Disconnected') store.setIsConnected(false);
      });
      unlisteners.current.push(unlistenStatus);

      const unlistenError = await listen<string>('scanner-error', (event) => {
        store.setError(event.payload);
        store.setIsConnected(false);
      });
      unlisteners.current.push(unlistenError);

      // 2. Call Rust Backend
      await invoke('start_scan', {
        vid_hex: store.vid,
        pid_hex: store.pid,
      });

      store.setIsScanning(true);

    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      store.setError(typeof err === 'string' ? err : 'Unknown error');
      store.setIsScanning(false);
      // Clean up listeners if start fails
      stopScanner();
    }
  };

  const stopScanner = () => {
    // Run all unlisten functions
    unlisteners.current.forEach(fn => fn());
    unlisteners.current = []; // Clear the array

    store.setIsScanning(false);
    store.setIsConnected(false);
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopScanner();
    };
  }, []);

  return { startScanner, stopScanner, ...store };
};