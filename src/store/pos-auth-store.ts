import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  memberToken: string | null;
  currentMember: Member | null;
  currentLocation: InventoryLocation | null;
  isRestoredSession: boolean;
  sessionUpdatedAt: number | null;
}

interface PosAuthActions {
  setDeviceKey: (key: string) => void;
  setMemberSession: (member: Member, token: string, isRestored?: boolean) => void;
  clearMemberSession: () => void;
  setCurrentLocation: (location: InventoryLocation) => void;
  clearCurrentLocation: () => void;
  refreshSession: () => void;
  resetAll: () => void;
  resetDevice: () => void;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'pos-auth-storage-v3';

const initialState: PosAuthState = {
  deviceKey: null,
  memberToken: null,
  currentMember: null,
  currentLocation: null,
  isRestoredSession: false,
  sessionUpdatedAt: null,
};

export const useAuthStore = create<PosAuthState & PosAuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDeviceKey: (key) => {
        set({ deviceKey: key });
      },

      setMemberSession: (member, token, isRestored = false) => {
        set({
          currentMember: member,
          memberToken: token,
          isRestoredSession: isRestored,
          sessionUpdatedAt: Date.now(),
        });
      },

      clearMemberSession: () => {
        set({
          currentMember: null,
          memberToken: null,
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

      // Reset everything to initial state
      resetAll: () => {
        set(initialState);
      },

      // Reset only device-related data (keeps member session if active)
      resetDevice: () => {
        set({
          deviceKey: null,
          currentLocation: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        deviceKey: state.deviceKey,
        currentLocation: state.currentLocation,
        memberToken: state.memberToken,
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

          // Clear only member-related data on expiration
          state.memberToken = null;
          state.currentMember = null;
          state.isRestoredSession = false;
          state.sessionUpdatedAt = null;
        }
      },
    }
  )
);