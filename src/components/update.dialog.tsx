'use client';

import { useUpdater } from '@/lib/UpdateProvider';
import { cn } from '@/lib/utils';
import { X, Download, RefreshCw, CheckCircle, AlertCircle, Rocket } from 'lucide-react';

export const UpdateDialog = () => {
  const { 
    isModalOpen, 
    closeModal, 
    startInstall, 
    status, 
    downloadProgress, 
    error 
  } = useUpdater();

  if (!isModalOpen) return null;

  const renderContent = () => {
    switch (status) {
      case 'DOWNLOADING':
        return (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <span>Downloading update...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          </div>
        );

      case 'DONE':
        return (
          <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Ready to Install</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                The update has been downloaded. Restart the app to apply changes.
              </p>
            </div>
            <button
              onClick={() => startInstall(true)} // Pass true to trigger relaunch
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <Rocket className="w-4 h-4" />
              Restart & Install
            </button>
          </div>
        );

      case 'ERROR':
        return (
          <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Update Failed</h3>
              <p className="text-sm text-red-500 mt-1 max-w-[250px] mx-auto">
                {error || 'Something went wrong while updating.'}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        );

      // PENDING (Default View)
      default: 
        return (
          <div className="space-y-6">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">What's New:</h4>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc pl-4">
                 {/* Ideally, you would parse `update.body` from the context here.
                    For now, we use placeholders or generic text.
                 */}
                 <li>Performance improvements and bug fixes.</li>
                 <li>Enhanced security patches.</li>
                 <li>New feature additions.</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => startInstall(false)} // false = just download first
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with Blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={status !== 'DOWNLOADING' ? closeModal : undefined}
      />

      {/* Dialog Card */}
      <div className={cn(
        "relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl ring-1 ring-zinc-900/5 dark:ring-white/10 overflow-hidden transform transition-all",
        "animate-in fade-in zoom-in-95 duration-200"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Update Available
            </h2>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">
              New version found
            </p>
          </div>
          {status !== 'DOWNLOADING' && (
            <button 
              onClick={closeModal}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 pt-2">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};