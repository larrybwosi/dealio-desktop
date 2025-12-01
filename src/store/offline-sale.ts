import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProcessSaleInput } from '@/lib/validation/transactions';

interface QueuedSale {
  id: string; // Unique ID for the queue item
  timestamp: number;
  data: ProcessSaleInput;
}

interface OfflineSaleState {
  queue: QueuedSale[];
  addToQueue: (data: ProcessSaleInput) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

export const useOfflineSaleStore = create<OfflineSaleState>()(
  persist(
    set => ({
      queue: [],
      addToQueue: data =>
        set(state => ({
          queue: [
            ...state.queue,
            {
              id: crypto.randomUUID(), // Native browser UUID
              timestamp: Date.now(),
              data,
            },
          ],
        })),
      removeFromQueue: id =>
        set(state => ({
          queue: state.queue.filter(item => item.id !== id),
        })),
      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: 'offline-sales-queue', // key in localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
