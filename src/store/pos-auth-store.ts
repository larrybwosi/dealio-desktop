import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { API_ENDPOINT } from '@/lib/axios';

type LocationType = 
  | "RETAIL_SHOP" 
  | "WAREHOUSE" 
  | "DISTRIBUTION" 
  | "PRODUCTION" 
  | "SUPPLIER" 
  | "CUSTOMER" 
  | "TEMPORARY" 
  | "OTHER";

type InventoryLocation = {
  name: string;
  id: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  locationType: LocationType;
  address: JSON | null;
  contact: JSON | null;
  capacity: JSON | null;
  settings: JSON | null;
  parentLocationId: string | null;
  customFields: JSON | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  organizationId: string;
};

export type Member = {
  id: string;
  organizationId: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  phone: string | null;
  email: string | null;
  address: string | null;
  age: string | null;
  gender: string | null;
  tags: string | null;
  cardId: string | null;
  isCheckedIn: boolean;
  lastCheckInTime: Date | null;
  currentCheckInLocationId: string | null;
  currentAttendanceLogId: string | null;
  name: string;
  image: string;
};

interface PosAuthState {
  deviceKey: string | null;
  currentMember: Member | null;
  currentLocation: InventoryLocation | null;
  isRestoredSession: boolean;
  sessionUpdatedAt: number | null;
  isInitialized: boolean;
}

interface PosAuthActions {
  setDeviceKey: (key: string) => void;
  setMemberSession: (member: Member, isRestored?: boolean) => void;
  clearMemberSession: () => void;
  setCurrentLocation: (location: InventoryLocation) => void;
  clearCurrentLocation: () => void;
  refreshSession: () => void;
  resetAll: () => void;
  resetDevice: () => void;
  
  // Async initialization
  initializeFromBackend: () => Promise<void>;
  registerDevice: (apiKey: string, location: InventoryLocation) => Promise<void>;
  switchLocation: (location: InventoryLocation) => Promise<void>;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'pos-auth-storage-v3';

const initialState: PosAuthState = {
  deviceKey: null,
  currentMember: null,
  currentLocation: null,
  isRestoredSession: false,
  sessionUpdatedAt: null,
  isInitialized: false,
};

export const useAuthStore = create<PosAuthState & PosAuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDeviceKey: (key) => {
        set({ deviceKey: key });
      },

      setMemberSession: (member, isRestored = false) => {
        set({
          currentMember: member,
          isRestoredSession: isRestored,
          sessionUpdatedAt: Date.now(),
        });
      },

      clearMemberSession: () => {
        set({
          currentMember: null,
          isRestoredSession: false,
          sessionUpdatedAt: null,
        });
      },

      refreshSession: () => {
        const { currentMember } = get();
        if (currentMember) {
          set({ sessionUpdatedAt: Date.now() });
        }
      },

      setCurrentLocation: (location) => {
        set({ currentLocation: location });
      },

      clearCurrentLocation: () => {
        set({ currentLocation: null });
      },

      resetAll: () => {
        set(initialState);
      },

      resetDevice: () => {
        set({
          deviceKey: null,
          currentLocation: null,
        });
      },

      initializeFromBackend: async () => {
        try {
          // rust struct: DeviceConfig { base_url, location_id, device_key }
          const config = await invoke<{ device_key: string, location_id: string, base_url: string } | null>('get_device_config');
          if (config) {
             set({ deviceKey: config.device_key });
             console.log("[AuthStore] Device key loaded from backend");
             
             // If currentLocation is not already hydrated from localStorage, fetch it
             const { currentLocation } = get();
             if (!currentLocation?.id && config.location_id) {
               console.log("[AuthStore] Fetching location from API...");
               try {
                 const response = await fetch(`${API_ENDPOINT}/api/v1/pos/locations`, {
                   headers: {
                     'Content-Type': 'application/json',
                     'X-Device-Api-Key': config.device_key,
                   },
                 });
                 if (response.ok) {
                   const data = await response.json();
                   const location = data.locations?.find((loc: { id: string }) => loc.id === config.location_id);
                   if (location) {
                     set({ currentLocation: location });
                     console.log("[AuthStore] Location restored from API");
                   }
                 }
               } catch (fetchError) {
                 console.error("[AuthStore] Failed to fetch location:", fetchError);
               }
             }
             set({ isInitialized: true });
             
             // Sync existing session to Rust if present
             const { currentMember } = get();
             if (currentMember) {
                console.log("[AuthStore] Restoring backend session...");
                invoke('restore_member_session', { 
                    member: {
                      id: currentMember.id,
                      name: currentMember.name,
                      role: (currentMember as any).role || 'staff'
                    } 
                }).catch(e => console.error("Failed to restore backend session:", e));
             }

          } else {
             set({ isInitialized: true });
          }
        } catch (error) {
           console.error("Failed to initialize auth store:", error);
           set({ isInitialized: true });
        }
      },

      registerDevice: async (apiKey: string, location: InventoryLocation) => {
         try {
             await invoke('set_device_config', {
                 baseUrl: API_ENDPOINT,
                 locationId: location.id,
                 deviceKey: apiKey
             });
             
             // Update local state
             set({ deviceKey: apiKey, currentLocation: location });
         } catch (error) {
             console.error("Failed to register device:", error);
             throw error;
         }
      },

      switchLocation: async (location) => {
        const previousLocation = get().currentLocation;
        const deviceKey = get().deviceKey;
        
        if (!deviceKey) {
            console.error("Cannot switch location: Device key missing");
            return;
        }

        // 1. Update location in backend config
        try {
            await invoke('set_device_config', {
                baseUrl: API_ENDPOINT,
                locationId: location.id,
                deviceKey: deviceKey
            });
            
            // 2. Update local state
            set({ currentLocation: location });
            
            // 3. Call switch_location command to load cached products and trigger sync
            const products = await invoke('switch_location', {
                newLocationId: location.id
            });
            
            // 4. Update product store via event
            window.dispatchEvent(new CustomEvent('location-changed', {
                detail: { 
                    locationId: location.id,
                    products,
                    previousLocationId: previousLocation?.id 
                }
            }));
            
        } catch (error) {
            console.error('Failed to switch location:', error);
        }
      }

    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        // REMOVED deviceKey and memberToken from here for security
        currentLocation: state.currentLocation,
        currentMember: state.currentMember,
        isRestoredSession: state.isRestoredSession,
        sessionUpdatedAt: state.sessionUpdatedAt,
      }),

      onRehydrateStorage: () => (state) => {
        if (!state?.sessionUpdatedAt) return;

        const now = Date.now();
        const isExpired = now - state.sessionUpdatedAt > ONE_HOUR_MS;

        if (isExpired) {
          console.log('Session expired. Clearing member data.');
          state.sessionUpdatedAt = null;
        }
      },
    }
  )
);