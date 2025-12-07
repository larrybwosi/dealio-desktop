'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateStatus = 'IDLE' | 'CHECKING' | 'PENDING' | 'DOWNLOADING' | 'DONE' | 'ERROR';

interface UpdaterContextType {
  isUpdateAvailable: boolean;
  isCritical: boolean; // <--- NEW: Tells UI to block closing
  releaseNotes: string | null;
  releaseDate: string | null;
  status: UpdateStatus;
  downloadProgress: number;
  isModalOpen: boolean;
  error: string | null;
  openModal: () => void;
  closeModal: () => void;
  checkForUpdates: () => Promise<void>;
  startInstall: () => Promise<void>;
}

const UpdaterContext = createContext<UpdaterContextType | undefined>(undefined);

interface UpdaterProviderProps {
  children: ReactNode;
  checkInterval?: number;
  deprecatedAfterDays?: number; // How many days before an update becomes mandatory
}

export const UpdaterProvider = ({ 
  children, 
  checkInterval = 3600000, // Default 1 hour
  deprecatedAfterDays = 14 // Default 2 weeks
}: UpdaterProviderProps) => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [releaseDate, setReleaseDate] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('IDLE');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => {
    // Prevent closing if critical
    if (isCritical) return; 
    setIsModalOpen(false);
  }, [isCritical]);

  const processUpdate = useCallback(async (updateObj: Update) => {
    setStatus('DOWNLOADING');
    setError(null);
    
    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await updateObj.downloadAndInstall((progress) => {
        switch (progress.event) {
          case 'Started':
            totalBytes = progress.data.contentLength || 0;
            break;
          case 'Progress':
            downloadedBytes += progress.data.chunkLength;
            if (totalBytes > 0) {
              setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
            break;
          case 'Finished':
             setStatus('DONE');
            break;
        }
      });
      
      // Auto relaunch after successful install
      await relaunch();
      
    } catch (e: any) {
      console.error('Update failed:', e);
      setError(e.message || 'Failed to update');
      setStatus('ERROR');
    }
  }, []);

  const startInstall = useCallback(async () => {
    if (!update) return;
    await processUpdate(update);
  }, [update, processUpdate]);

  const checkForUpdates = useCallback(async () => {
    setStatus('CHECKING');
    setError(null);

    try {
      const updateResult = await check();

      if (updateResult) {
        setUpdate(updateResult);
        setIsUpdateAvailable(true);
        setReleaseNotes(updateResult.body || '');
        setReleaseDate(updateResult.date || null);
        setStatus('PENDING');

        // --- DEPRECATION LOGIC ---
        let critical = false;

        // 1. Check for manual flag in release notes
        if (updateResult.body && updateResult.body.includes('[CRITICAL]')) {
            critical = true;
        }

        // 2. Check for time-based deprecation
        if (updateResult.date) {
            const releaseDateObj = new Date(updateResult.date);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - releaseDateObj.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > deprecatedAfterDays) {
                critical = true;
            }
        }

        setIsCritical(critical);
        setIsModalOpen(true); // Always open modal on update found
      }
    } catch (e: any) {
      console.error('Failed to check for updates:', e);
      setError(e.message);
      setStatus('ERROR');
    }
  }, [deprecatedAfterDays]);

  useEffect(() => {
    checkForUpdates();
    let intervalId: NodeJS.Timeout;
    if (checkInterval > 0) {
      intervalId = setInterval(checkForUpdates, checkInterval);
    }
    return () => clearInterval(intervalId);
  }, [checkForUpdates, checkInterval]);

  const value = {
    isUpdateAvailable,
    isCritical,
    releaseNotes,
    releaseDate,
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
  if (!context) throw new Error('useUpdater must be used within an UpdaterProvider');
  return context;
};