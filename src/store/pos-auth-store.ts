import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Member, InventoryLocation } from '@prisma/client';

// Define the state structure
interface PosAuthState {
  deviceKey: string | null;
  memberToken: string | null;
  currentMember: Member | null;
  currentLocation: InventoryLocation | null;
  /** * Indicates if the current session was restored from an existing check-in
   * rather than a fresh check-in event.
   */
  isRestoredSession: boolean;
}

// Define the actions
interface PosAuthActions {
  setDeviceKey: (key: string) => void;
  setMemberSession: (member: Member, token: string, isRestored?: boolean) => void;
  clearMemberSession: () => void;
  setCurrentLocation: (location: InventoryLocation) => void;
  clearCurrentLocation: () => void;
}

// Initial state
const initialState: PosAuthState = {
  deviceKey: null,
  memberToken: null,
  currentMember: null,
  currentLocation: null,
  isRestoredSession: false,
};

/**
 * Your enterprise POS auth store.
 *
 * This store is persisted to localStorage.
 * - `deviceKey` and `currentLocation` are persisted so the POS terminal stays authenticated.
 * - `memberToken`, `currentMember`, and `isRestoredSession` are *not* persisted.
 * This is a security best practice. It forces a re-login
 * if the app is fully closed or refreshed, preventing
 * an active session from being "stuck" if the app crashes.
 */
export const usePosAuthStore = create<PosAuthState & PosAuthActions>()(
  persist(
    set => ({
      ...initialState,

      // Action to set the device key (e.g., on app startup)
      setDeviceKey: key => {
        set({ deviceKey: key });
      },

      // Action to set the active member session (on check-in)
      setMemberSession: (member, token, isRestored = false) => {
        set({
          currentMember: member,
          memberToken: token,
          isRestoredSession: isRestored,
        });
      },

      // Action to clear the member session (on check-out or error)
      clearMemberSession: () => {
        set({
          currentMember: null,
          memberToken: null,
          isRestoredSession: false,
        });
      },

      // Action to set the current location
      setCurrentLocation: location => {
        set({ currentLocation: location });
      },

      // Action to clear the current location
      clearCurrentLocation: () => {
        set({ currentLocation: null });
      },
    }),
    {
      name: 'pos-auth-storage', // Name in localStorage
      storage: createJSONStorage(() => localStorage), // Use localStorage

      // We only want to persist the `deviceKey` and `currentLocation`.
      // The member session is ephemeral and should not be persisted.
      partialize: state => ({
        deviceKey: state.deviceKey,
        currentLocation: state.currentLocation,
      }),
    }
  )
);
