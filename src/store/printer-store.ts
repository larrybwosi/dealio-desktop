import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';

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

  setPrinters: (printers: PrinterDevice[]) => void;
  assignPrinter: (type: PrinterJobType, printerId: string) => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      availablePrinters: [],
      
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
    }),
    {
      name: 'printer-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ assignments: state.assignments }), // Only save assignments
    }
  )
);