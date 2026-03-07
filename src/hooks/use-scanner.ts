import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useScannerStore } from '@/store/barcode-scanner';

interface ScanPayload {
  message: string;
  source: string;
}

export const useScanner = () => {
  const store = useScannerStore();

  const isMounted = useRef(false);
  const unlisteners = useRef<UnlistenFn[]>([]);

  const startScanner = async () => {
    if (store.isScanning) return;

    if (!store.vid || !store.pid) {
      store.setError('Vendor ID and Product ID are missing.');
      return;
    }

    store.setError(null);

    try {
      const unlistenData = await listen<ScanPayload>('scanner-data', event => {
        // You can now log/use the source (e.g., 'USB' or 'Network')
        console.log(`[${event.payload.source}] Barcode Received:`, event.payload.message);
        store.addScannedItem(event.payload.message);
      });
      unlisteners.current.push(unlistenData);

      const unlistenStatus = await listen<string>('scanner-status', event => {
        const status = event.payload;
        // UPDATE 2: Use .includes() to catch "Connected (USB)" or "Network Server Listening"
        if (status.includes('Connected') || status.includes('Listening')) {
          store.setIsConnected(true);
        }
        if (status.includes('Disconnected')) {
          store.setIsConnected(false);
        }
      });
      unlisteners.current.push(unlistenStatus);

      const unlistenError = await listen<string>('scanner-error', event => {
        store.setError(event.payload);
        store.setIsConnected(false);
      });
      unlisteners.current.push(unlistenError);

      await invoke('start_scan', {
        vid_hex: store.vid,
        pid_hex: store.pid,
      });

      store.setIsScanning(true);
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      store.setError(typeof err === 'string' ? err : 'Unknown error');
      store.setIsScanning(false);
      stopScanner();
    }
  };

  const stopScanner = () => {
    unlisteners.current.forEach(fn => fn());
    unlisteners.current = [];

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
