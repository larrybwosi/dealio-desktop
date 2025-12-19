'use client';

import { useEffect, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { 
  ShieldAlert, 
  Sparkles, 
  X, 
  Download, 
  ArrowRight,
  FileText 
} from 'lucide-react';

// --- Markdown Styling Overrides ---
const markdownOptions = {
  overrides: {
    h1: {
      component: ({ children, ...props }: any) => (
        <h1 {...props} className="mb-2 mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">{children}</h1>
      ),
    },
    h2: {
      component: ({ children, ...props }: any) => (
        <h2 {...props} className="mb-2 mt-4 text-base font-bold text-gray-800 dark:text-gray-200">{children}</h2>
      ),
    },
    h3: {
      component: ({ children, ...props }: any) => (
        <h3 {...props} className="mb-1 mt-3 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">{children}</h3>
      ),
    },
    p: {
      component: ({ children, ...props }: any) => (
        <p {...props} className="mb-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{children}</p>
      ),
    },
    ul: {
      component: ({ children, ...props }: any) => (
        <ul {...props} className="mb-3 ml-4 list-disc space-y-1 text-gray-600 dark:text-gray-300">{children}</ul>
      ),
    },
    li: {
      component: ({ children, ...props }: any) => (
        <li {...props} className="text-sm">{children}</li>
      ),
    },
    a: {
      component: ({ children, ...props }: any) => (
        <a {...props} className="font-medium text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">{children}</a>
      ),
    },
    code: {
      component: ({ children, ...props }: any) => (
        <code {...props} className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">{children}</code>
      ),
    },
    blockquote: {
        component: ({ children, ...props }: any) => (
          <blockquote {...props} className="my-2 border-l-4 border-gray-300 pl-4 italic text-gray-500 dark:border-gray-700">{children}</blockquote>
        ),
      },
  },
};

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  releaseNotes: string | null;
  isCritical: boolean;
}

export function UpdateDialog({
  open,
  onOpenChange,
  onClose,
  onConfirm,
  releaseNotes,
  isCritical,
}: UpdateDialogProps) {
  const [isMounting, setIsMounting] = useState(false);

  // Handle animation mounting
  useEffect(() => {
    if (open) setIsMounting(true);
    else setTimeout(() => setIsMounting(false), 200);
  }, [open]);

  if (!open && !isMounting) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isCritical) return;
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${
        open ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/60" 
        onClick={handleBackdropClick} 
        aria-hidden="true" 
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-lg transform flex flex-col max-h-[85vh] overflow-hidden rounded-xl bg-white text-left shadow-2xl ring-1 ring-gray-900/5 transition-all duration-300 dark:bg-gray-900 dark:ring-white/10 ${
          open ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 relative border-b border-gray-100 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
          {!isCritical && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isCritical 
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {isCritical ? <ShieldAlert className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                {isCritical ? 'Critical Update Required' : 'New Version Available'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isCritical 
                  ? 'This update includes important security fixes.' 
                  : 'A new version of the application is ready to install.'}
              </p>
            </div>
          </div>
        </div>

        {/* Release Notes Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <FileText className="h-3 w-3" />
                Release Notes
            </div>
            
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/50">
                {releaseNotes ? (
                    <div className="prose-sm">
                        <Markdown options={markdownOptions}>
                            {releaseNotes}
                        </Markdown>
                    </div>
                ) : (
                    <div className="flex h-20 items-center justify-center text-sm italic text-gray-400">
                        No release notes provided.
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 flex flex-col-reverse gap-3 bg-gray-50 p-6 sm:flex-row sm:justify-end dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
          {!isCritical && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Remind Me Later
            </button>
          )}
          
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isCritical
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {isCritical ? (
              <>
                Update Now
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download & Install
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}