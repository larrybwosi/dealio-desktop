import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useScannerStore } from '@/store/barcode-scanner';

interface ScanPayload {
  message: string;
}

export const useScanner = () => {
  const store = useScannerStore();
  
  // Refs to track listeners so we can clean them up easily
  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenStatusRef = useRef<UnlistenFn | null>(null);
  const unlistenErrorRef = useRef<UnlistenFn | null>(null);

  /**
   * Initialize the scanner: 
   * 1. Sets up event listeners
   * 2. Invokes the Rust command to open the HID device
   */
  const startScanner = async () => {
    // Prevent starting if already scanning to avoid duplicate listeners
    if (store.isScanning) return;

    store.setError(null);

    try {
      // 1. Setup Listeners
      unlistenDataRef.current = await listen<ScanPayload>('scanner-data', (event) => {
        console.log('Barcode Received:', event.payload.message);
        store.addScannedItem(event.payload.message);
      });

      unlistenStatusRef.current = await listen<string>('scanner-status', (event) => {
        const status = event.payload;
        if (status === 'Connected') store.setIsConnected(true);
        if (status === 'Disconnected') store.setIsConnected(false);
      });

      unlistenErrorRef.current = await listen<string>('scanner-error', (event) => {
        store.setError(event.payload);
        store.setIsConnected(false);
      });

      // 2. Call Rust Backend
      // Matches the Rust function signature: fn start_scan(..., vid_hex, pid_hex)
      const msg = await invoke<string>('start_scan', {
        vidHex: store.vid,
        pidHex: store.pid,
      });

      console.log(msg);
      store.setIsScanning(true);

    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      store.setError(typeof err === 'string' ? err : 'Unknown error starting scanner');
      store.setIsScanning(false);
    }
  };

  /**
   * Stop listening (Cleanup)
   * Note: This stops the Frontend from listening. 
   * To fully stop the Rust thread, you would need to implement a 'stop_scan' command in Rust,
   * but usually, unlistening on the frontend is sufficient for UI purposes.
   */
  const stopScanner = () => {
    if (unlistenDataRef.current) unlistenDataRef.current();
    if (unlistenStatusRef.current) unlistenStatusRef.current();
    if (unlistenErrorRef.current) unlistenErrorRef.current();

    store.setIsScanning(false);
    store.setIsConnected(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return {
    startScanner,
    stopScanner,
    // We expose these for convenience, though they are also in the store
    ...store
  };
};