// store/pos-auth-store.ts
import { createWithEqualityFn as create } from "zustand/traditional";
import { persist, createJSONStorage } from "zustand/middleware";
import { Member } from "@prisma/client";

// Define the state structure
interface PosAuthState {
  deviceKey: string | null;
  memberToken: string | null;
  currentMember: Member | null;
}

// Define the actions
interface PosAuthActions {
  setDeviceKey: (key: string) => void;
  setMemberSession: (member: Member, token: string) => void;
  clearMemberSession: () => void;
}

// Initial state
const initialState: PosAuthState = {
  deviceKey: null,
  memberToken: null,
  currentMember: null,
};

/**
 * Your enterprise POS auth store.
 *
 * This store is persisted to localStorage.
 * - `deviceKey` is persisted so the POS terminal stays authenticated.
 * - `memberToken` and `currentMember` are *not* persisted.
 * This is a security best practice. It forces a re-login
 * if the app is fully closed or refreshed, preventing
 * an active session from being "stuck" if the app crashes.
 */
export const usePosAuthStore = create<PosAuthState & PosAuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      // Action to set the device key (e.g., on app startup)
      setDeviceKey: (key) => {
        set({ deviceKey: key });
      },

      // Action to set the active member session (on check-in)
      setMemberSession: (member, token) => {
        set({ currentMember: member, memberToken: token });
      },

      // Action to clear the member session (on check-out or error)
      clearMemberSession: () => {
        set({ currentMember: null, memberToken: null });
      },
    }),
    {
      name: "pos-auth-storage", // Name in localStorage
      storage: createJSONStorage(() => localStorage), // Use localStorage

      // We only want to persist the `deviceKey`.
      // The member session is ephemeral and should not be persisted.
      partialize: (state) => ({
        deviceKey: state.deviceKey,
      }),
    }
  )
);
