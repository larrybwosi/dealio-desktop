import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProcessSaleInput } from '@/lib/validation/transactions';

interface QueuedSale {
  id: string; // Unique ID for the queue item
  timestamp: number;
  data: ProcessSaleInput;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

interface OfflineSaleState {
  queue: QueuedSale[];
  addToQueue: (data: ProcessSaleInput) => QueuedSale;
  updateQueueItem: (id: string, updates: Partial<QueuedSale>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  getPendingSales: () => QueuedSale[];
}

export const useOfflineSaleStore = create<OfflineSaleState>()(
  persist(
    (set, get) => ({
      queue: [],
      addToQueue: data => {
        const newSale: QueuedSale = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          data,
          status: 'PENDING',
          retryCount: 0,
        };
        
        set(state => ({
          queue: [...state.queue, newSale],
        }));

        return newSale;
      },
      updateQueueItem: (id, updates) =>
        set(state => ({
          queue: state.queue.map(item =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      removeFromQueue: id =>
        set(state => ({
          queue: state.queue.filter(item => item.id !== id),
        })),
      clearQueue: () => set({ queue: [] }),
      getPendingSales: () => get().queue.filter(item => item.status === 'PENDING' || item.status === 'FAILED'),
    }),
    {
      name: 'offline-sales-queue', // key in localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
