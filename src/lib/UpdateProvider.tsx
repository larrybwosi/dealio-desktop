'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateStatus = 'IDLE' | 'CHECKING' | 'PENDING' | 'DOWNLOADING' | 'DONE' | 'ERROR';

interface UpdaterContextType {
  isUpdateAvailable: boolean;
  status: UpdateStatus;
  downloadProgress: number;
  isModalOpen: boolean;
  error: string | null;
  openModal: () => void;
  closeModal: () => void;
  checkForUpdates: () => Promise<void>;
  startInstall: (shouldRelaunch?: boolean) => Promise<void>;
}

const UpdaterContext = createContext<UpdaterContextType | undefined>(undefined);

interface UpdaterProviderProps {
  children: ReactNode;
  autoDownload?: boolean; // New prop to enable auto-downloading
  checkInterval?: number; // Optional: Interval in ms (e.g., 1 hour)
}

export const UpdaterProvider = ({ 
  children, 
  autoDownload = false,
  checkInterval = 0 
}: UpdaterProviderProps) => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('IDLE');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  /**
   * Core logic to download and install the update.
   * We pass the 'update' object explicitly to avoid stale state issues in useEffect.
   */
  const processUpdate = useCallback(async (updateObj: Update, shouldRelaunch: boolean = true) => {
    setStatus('DOWNLOADING');
    setError(null);
    
    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await updateObj.downloadAndInstall((progress) => {
        switch (progress.event) {
          case 'Started':
            totalBytes = progress.data.contentLength || 0;
            console.log(`Update started. Size: ${totalBytes}`);
            break;
          case 'Progress':
            downloadedBytes += progress.data.chunkLength;
            if (totalBytes > 0) {
              setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
            break;
          case 'Finished':
            console.log('Download finished.');
            break;
        }
      });

      setStatus('DONE');

      if (shouldRelaunch) {
        await relaunch();
      }
    } catch (e: any) {
      console.error('Update failed:', e);
      setError(e.message || 'Failed to update');
      setStatus('ERROR');
    }
  }, []);

  /**
   * Public function to trigger install manually (e.g., from a button)
   * Uses the state 'update' object.
   */
  const startInstall = useCallback(async (shouldRelaunch: boolean = true) => {
    if (!update) {
      console.error('No update available to install.');
      return;
    }
    await processUpdate(update, shouldRelaunch);
  }, [update, processUpdate]);

  /**
   * Check for updates.
   * Handles setting state and triggering auto-download if enabled.
   */
  const checkForUpdates = useCallback(async () => {
    setStatus('CHECKING');
    setError(null);

    try {
      const updateResult = await check();

      if (updateResult) {
        console.log('Update found:', updateResult.version);
        setUpdate(updateResult);
        setIsUpdateAvailable(true);
        setStatus('PENDING');

        // Logic for Auto-Download
        if (autoDownload) {
          // If auto-download is on, we usually don't want to force relaunch immediately 
          // (interrupting the user). We download, then let them click a button to restart.
          // Pass `false` for relaunch, or `true` if you want an aggressive update.
          await processUpdate(updateResult, false); 
        } else {
          // Only open modal if we aren't auto-downloading
          setIsModalOpen(true);
        }
      } else {
        console.log('No update available.');
        setStatus('IDLE');
      }
    } catch (e: any) {
      console.error('Failed to check for updates:', e);
      setError(e.message);
      setStatus('ERROR');
    }
  }, [autoDownload, processUpdate]);

  // Initial Check on Mount
  useEffect(() => {
    checkForUpdates();

    // Optional: Polling interval
    let intervalId: NodeJS.Timeout;
    if (checkInterval > 0) {
      intervalId = setInterval(checkForUpdates, checkInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkForUpdates, checkInterval]);

  const value = {
    isUpdateAvailable,
    status,
    downloadProgress,
    isModalOpen,
    error,
    openModal,
    closeModal,
    checkForUpdates,
    startInstall,
  };

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>;
};

export const useUpdater = (): UpdaterContextType => {
  const context = useContext(UpdaterContext);
  if (!context) {
    throw new Error('useUpdater must be used within an UpdaterProvider');
  }
  return context;
};