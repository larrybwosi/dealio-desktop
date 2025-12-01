import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PrintJob, PrintQueueItem } from '@/types/print-types';

export interface PrinterDevice {
  id: string;
  name: string;
  driver_name: string;
  description: string;
}

// Define the types of documents we handle
export type PrinterJobType = 'receipt' | 'invoice' | 'kitchen';

interface PrinterState {
  availablePrinters: PrinterDevice[];
  
  // This maps a Job Type to a Printer ID
  assignments: Record<PrinterJobType, string | null>;

  // Print job tracking
  printHistory: PrintJob[];
  printQueue: PrintQueueItem[];

  setPrinters: (printers: PrinterDevice[]) => void;
  assignPrinter: (type: PrinterJobType, printerId: string) => void;
  
  // Print job management
  addPrintJob: (job: PrintJob) => void;
  updatePrintJob: (jobId: string, updates: Partial<PrintJob>) => void;
  addToQueue: (item: PrintQueueItem) => void;
  removeFromQueue: (jobId: string) => void;
  clearPrintHistory: () => void;
  getPrintJob: (jobId: string) => PrintJob | undefined;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      availablePrinters: [],
      printHistory: [],
      printQueue: [],
      
      // Default assignments are null
      assignments: {
        receipt: null,
        invoice: null,
        kitchen: null,
      },

      setPrinters: (printers) => set({ availablePrinters: printers }),
      
      assignPrinter: (type, printerId) => 
        set((state) => ({
          assignments: {
            ...state.assignments,
            [type]: printerId, // Update only the specific role
          }
        })),

      // Print job management
      addPrintJob: (job) =>
        set((state) => ({
          printHistory: [job, ...state.printHistory].slice(0, 50), // Keep last 50 jobs
        })),

      updatePrintJob: (jobId, updates) =>
        set((state) => ({
          printHistory: state.printHistory.map((job) =>
            job.id === jobId ? { ...job, ...updates } : job
          ),
          printQueue: state.printQueue.map((item) =>
            item.id === jobId ? { ...item, ...updates } : item
          ),
        })),

      addToQueue: (item) =>
        set((state) => ({
          printQueue: [...state.printQueue, item],
        })),

      removeFromQueue: (jobId) =>
        set((state) => ({
          printQueue: state.printQueue.filter((item) => item.id !== jobId),
        })),

      clearPrintHistory: () => set({ printHistory: [] }),

      getPrintJob: (jobId) => {
        const state = get();
        return state.printHistory.find((job) => job.id === jobId);
      },
    }),
    {
      name: 'printer-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        assignments: state.assignments,
        printHistory: state.printHistory.slice(0, 20), // Persist only last 20
      }),
    }
  )
);