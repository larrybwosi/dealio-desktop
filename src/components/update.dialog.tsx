'use client';

import { useEffect, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { 
  ShieldAlert, 
  Sparkles, 
  X, 
  Download, 
  ArrowRight,
  ScrollText,
  AlertTriangle
} from 'lucide-react';

// --- Markdown Styling Overrides (Shadcn Typography Compatible) ---
const markdownOptions = {
  overrides: {
    h1: {
      component: ({ children, ...props }: any) => (
        <h1 {...props} className="mt-6 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 dark:text-zinc-50 text-zinc-900">
          {children}
        </h1>
      ),
    },
    h2: {
      component: ({ children, ...props }: any) => (
        <h2 {...props} className="mt-6 scroll-m-20 pb-2 text-xl font-semibold tracking-tight first:mt-0 dark:text-zinc-100 text-zinc-800">
          {children}
        </h2>
      ),
    },
    h3: {
      component: ({ children, ...props }: any) => (
        <h3 {...props} className="mt-4 scroll-m-20 text-base font-semibold tracking-tight dark:text-zinc-100 text-zinc-800">
          {children}
        </h3>
      ),
    },
    p: {
      component: ({ children, ...props }: any) => (
        <p {...props} className="leading-7 [&:not(:first-child)]:mt-3 text-sm dark:text-zinc-400 text-zinc-600">
          {children}
        </p>
      ),
    },
    ul: {
      component: ({ children, ...props }: any) => (
        <ul {...props} className="my-3 ml-6 list-disc [&>li]:mt-2 text-sm dark:text-zinc-400 text-zinc-600">
          {children}
        </ul>
      ),
    },
    li: {
      component: ({ children, ...props }: any) => (
        <li {...props}>{children}</li>
      ),
    },
    a: {
      component: ({ children, ...props }: any) => (
        <a {...props} className="font-medium text-primary underline underline-offset-4 dark:text-blue-400 text-blue-600 hover:text-blue-500" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    },
    code: {
      component: ({ children, ...props }: any) => (
        <code {...props} className="relative rounded bg-zinc-100 px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
          {children}
        </code>
      ),
    },
    blockquote: {
        component: ({ children, ...props }: any) => (
          <blockquote {...props} className="mt-4 border-l-2 border-zinc-300 pl-6 italic text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {children}
          </blockquote>
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
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation mounting
  useEffect(() => {
    if (open) setIsVisible(true);
    else {
        const timer = setTimeout(() => setIsVisible(false), 200);
        return () => clearTimeout(timer);
    }
  }, [open]);

  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isCritical) return;
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center isolate">
      {/* Backdrop - Standard Shadcn Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 transition-opacity duration-200 ease-out ${
            open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick} 
        aria-hidden="true" 
      />

      {/* Modal Content */}
      <div
        className={`
            relative z-50 grid w-full max-w-3xl gap-4 border bg-white p-0 shadow-lg duration-200 sm:rounded-xl 
            dark:bg-zinc-950 dark:border-zinc-800 
            ${open 
                ? 'animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]' 
                : 'animate-out fade-out-0 zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-[48%]'
            }
        `}
      >
        {/* Header */}
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <div className="flex items-start justify-between">
                <div className="flex gap-4">
                    {/* Icon Box */}
                    <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                        isCritical 
                        ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-500' 
                        : 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50'
                    }`}>
                        {isCritical ? <ShieldAlert className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    </div>
                    
                    <div>
                        <h2 className="text-lg font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
                            {isCritical ? 'Critical Update Required' : 'Update Available'}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            {isCritical 
                                ? 'Security patches and critical performance improvements are included in this version.' 
                                : 'A new version has been released with the following improvements and fixes.'}
                        </p>
                    </div>
                </div>

                {/* Close Button (Hidden if critical) */}
                {!isCritical && (
                    <button
                        onClick={onClose}
                        className="rounded-md p-2 text-zinc-400 opacity-70 ring-offset-white hover:bg-zinc-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-500 dark:ring-offset-zinc-950 dark:hover:bg-zinc-800 dark:focus:ring-zinc-300 dark:data-[state=open]:bg-zinc-800"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </button>
                )}
            </div>
        </div>

        {/* Separator */}
        <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />

        {/* Body / Scroll Area */}
        <div className="px-6 py-2">
            <div className="flex items-center gap-2 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <ScrollText className="h-3.5 w-3.5" />
                Release Notes
            </div>
            
            <div className="relative h-[300px] w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar">
                    {releaseNotes ? (
                        <div className="prose-sm dark:prose-invert">
                            <Markdown options={markdownOptions}>
                                {releaseNotes}
                            </Markdown>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
                            <AlertTriangle className="h-8 w-8 opacity-20" />
                            <p className="text-sm">No release notes available for this version.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-4">
             {!isCritical && (
                <button
                    onClick={onClose}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 h-10 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 dark:ring-offset-zinc-950"
                >
                    Remind me later
                </button>
            )}
            
            <button
                onClick={onConfirm}
                className={`
                    inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 dark:ring-offset-zinc-950
                    ${isCritical 
                        ? 'bg-red-600 text-zinc-50 hover:bg-red-600/90 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/90' 
                        : 'bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90'
                    }
                `}
            >
                {isCritical ? (
                    <>
                        Update Now <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                ) : (
                    <>
                        <Download className="mr-2 h-4 w-4" /> Download Update
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}