import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUpdater } from '@/lib/UpdateProvider';
import { X, Download, RotateCw, AlertCircle, ShieldAlert } from 'lucide-react';

export const UpdateDialog = () => {
  const { 
    isModalOpen, 
    closeModal, 
    startInstall, 
    releaseNotes, 
    releaseDate,
    status, 
    downloadProgress,
    isCritical,
    error 
  } = useUpdater();

  const notesRef = useRef<HTMLDivElement>(null);

  // Close on Escape key (unless critical)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCritical && status !== 'DOWNLOADING') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeModal, isCritical, status]);

  if (!isModalOpen) return null;

  const isDownloading = status === 'DOWNLOADING';
  
  // Format date nicely
  const formattedDate = releaseDate 
    ? new Date(releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Just now';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={!isCritical && !isDownloading ? closeModal : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 border border-slate-100 ring-1 ring-black/5">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold leading-6 text-slate-900">
                {isCritical ? 'Critical Security Update' : 'New Version Available'}
              </h3>
              {isCritical && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                  Required
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Released on {formattedDate}
            </p>
          </div>
          
          {/* Close Button (Hidden if critical or downloading) */}
          {!isCritical && !isDownloading && (
            <button
              onClick={closeModal}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="px-6 py-6">
          {/* Error State */}
          {status === 'ERROR' && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Update Failed</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error || 'An unknown error occurred during the update process.'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Release Notes Scroller */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-900 mb-2">Release Notes</h4>
            <div 
              ref={notesRef}
              className="prose prose-sm prose-slate max-w-none h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 shadow-inner scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
            >
               <ReactMarkdown>{releaseNotes || 'No release notes provided.'}</ReactMarkdown>
            </div>
          </div>

          {/* Progress Bar (Only visible when downloading) */}
          {isDownloading && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between text-sm font-medium text-slate-700">
                <span>Downloading update...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center pt-1">
                The application will restart automatically when finished.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
          {!isDownloading && (
            <>
              {!isCritical && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                >
                  Remind Me Later
                </button>
              )}
              
              <button
                type="button"
                onClick={() => startInstall()}
                className={`inline-flex items-center gap-2 justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all
                  ${isCritical 
                    ? 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600' 
                    : 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600'
                  }
                `}
              >
                {isCritical ? <ShieldAlert className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {isCritical ? 'Install Critical Update' : 'Update & Restart'}
              </button>
            </>
          )}

          {/* If downloading, show a disabled state or spinner just to keep layout stable */}
          {isDownloading && (
             <button
                disabled
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
             >
               <RotateCw className="h-4 w-4 animate-spin" />
               Processing...
             </button>
          )}
        </div>
      </div>
    </div>
  );
};