import { createWithEqualityFn as create } from 'zustand/traditional';
import { load, Store } from '@tauri-apps/plugin-store';
import { ProcessSaleInput } from '@/lib/validation/transactions';

// --- Types ---

export interface QueuedSale {
  id: string; // Unique ID (UUID)
  timestamp: number;
  data: ProcessSaleInput;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

interface OfflineSaleState {
  // State
  queue: QueuedSale[];
  isStoreReady: boolean;

  // Actions
  initStore: () => Promise<void>;
  addToQueue: (data: ProcessSaleInput) => Promise<QueuedSale>;
  updateQueueItem: (id: string, updates: Partial<QueuedSale>) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  
  // Selectors (Synchronous access to currently loaded state)
  getPendingSales: () => QueuedSale[];
}

// --- Constants ---
const STORE_FILENAME = 'offline_sales.bin';
const KEY_SALES_QUEUE = 'sales_queue';

// --- Store Instance Helper ---
let storeInstance: Store | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_FILENAME, { autoSave: false, defaults:{} }); // We will save manually for atomic control
  }
  return storeInstance;
}

// --- Zustand Store ---

export const useOfflineSaleStore = create<OfflineSaleState>((set, get) => ({
  queue: [],
  isStoreReady: false,

  initStore: async () => {
    try {
      const store = await getStore();
      const storedQueue = await store.get<QueuedSale[]>(KEY_SALES_QUEUE);
      
      if (storedQueue) {
        set({ queue: storedQueue, isStoreReady: true });
      } else {
        set({ queue: [], isStoreReady: true });
      }
      console.log(`[OfflineStore] Initialized with ${storedQueue?.length || 0} items.`);
    } catch (error) {
      console.error('[OfflineStore] Failed to initialize:', error);
      // Fallback to empty queue in memory if file load fails
      set({ queue: [], isStoreReady: true });
    }
  },

  addToQueue: async (data) => {
    const newSale: QueuedSale = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data,
      status: 'PENDING',
      retryCount: 0,
    };

    const currentQueue = get().queue;
    const newQueue = [...currentQueue, newSale];

    // 1. Update Memory
    set({ queue: newQueue });

    // 2. Persist to Disk
    try {
      const store = await getStore();
      await store.set(KEY_SALES_QUEUE, newQueue);
      await store.save();
    } catch (error) {
      console.error('[OfflineStore] Failed to persist new sale:', error);
      // We don't throw here to ensure UI doesn't crash, but you might want to alert the user
    }

    return newSale;
  },

  updateQueueItem: async (id, updates) => {
    const currentQueue = get().queue;
    const newQueue = currentQueue.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );

    set({ queue: newQueue });

    try {
      const store = await getStore();
      await store.set(KEY_SALES_QUEUE, newQueue);
      await store.save();
    } catch (error) {
      console.error('[OfflineStore] Failed to update queue item:', error);
    }
  },

  removeFromQueue: async (id) => {
    const currentQueue = get().queue;
    const newQueue = currentQueue.filter(item => item.id !== id);

    set({ queue: newQueue });

    try {
      const store = await getStore();
      await store.set(KEY_SALES_QUEUE, newQueue);
      await store.save();
    } catch (error) {
      console.error('[OfflineStore] Failed to remove queue item:', error);
    }
  },

  clearQueue: async () => {
    set({ queue: [] });
    try {
      const store = await getStore();
      await store.set(KEY_SALES_QUEUE, []);
      await store.save();
    } catch (error) {
      console.error('[OfflineStore] Failed to clear queue:', error);
    }
  },

  getPendingSales: () => {
    return get().queue.filter(
      item => item.status === 'PENDING' || item.status === 'FAILED'
    );
  },
}));