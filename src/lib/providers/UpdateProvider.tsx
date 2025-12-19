'use client';

import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { UpdateDialog } from '@/components/update.dialog';

// --- Types ---
type UpdateStatus = 'IDLE' | 'CHECKING' | 'PENDING' | 'DOWNLOADING' | 'DONE' | 'ERROR';

interface UpdaterContextType {
  isUpdateAvailable: boolean;
  isCritical: boolean;
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

// --- Internal Toast Component for Download Progress ---
const ProgressToast = ({ progress }: { progress: number }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Downloading Update...
        </h4>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {progress}%
        </span>
      </div>
      
      {/* Progress Bar Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {/* Progress Bar Fill */}
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        The application will restart automatically when finished.
      </p>
    </div>
  );
};

interface UpdaterProviderProps {
  children: ReactNode;
  checkInterval?: number;
  deprecatedAfterDays?: number;
}

export const UpdaterProvider = ({ 
  children, 
  checkInterval = 3600000, 
  deprecatedAfterDays = 14 
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
    // Close the dialog when download starts so the Toast takes over
    // Unless it's critical, you might want to keep the blocker open.
    // Here we close it to show the toast:
    if (!isCritical) setIsModalOpen(false);
    
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
      
      await relaunch();
      
    } catch (e: any) {
      console.error('Update failed:', e);
      setError(e.message || 'Failed to update');
      setStatus('ERROR');
      // Re-open modal to show error
      setIsModalOpen(true);
    }
  }, [isCritical]);

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
        if (updateResult.body && updateResult.body.includes('[CRITICAL]')) {
            critical = true;
        }
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
        setIsModalOpen(true);
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

  return (
    <UpdaterContext.Provider value={value}>
      {children}
      
      {/* 1. The Update Dialog */}
      <UpdateDialog 
        open={isModalOpen}
        onOpenChange={(open) => !open && closeModal()} 
        onClose={closeModal} 
        onConfirm={startInstall}
        releaseNotes={releaseNotes}
        isCritical={isCritical}
      />

      {/* 2. The Download Toast */}
      {status === 'DOWNLOADING' && (
        <ProgressToast progress={downloadProgress} />
      )}
      
    </UpdaterContext.Provider>
  );
};