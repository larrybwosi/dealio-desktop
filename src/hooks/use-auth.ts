// hooks/use-pos-auth.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import { usePosAuthStore } from "@/store/pos-auth-store";
import { Member } from "@prisma/client";

// Types for API mutations
interface CheckInResponse {
  member: Member;
  token: string;
}
interface CheckInVariables {
  cardId: string;
  locationId: string;
  password: string;
}
interface CheckOutVariables {
  locationId: string;
}

export function usePosAuth() {
  const queryClient = useQueryClient();

  // Get state and actions directly from the Zustand store
  const { currentMember, setDeviceKey, setMemberSession, clearMemberSession } =
    usePosAuthStore((state) => ({
      currentMember: state.currentMember,
      setDeviceKey: state.setDeviceKey,
      setMemberSession: state.setMemberSession,
      clearMemberSession: state.clearMemberSession,
    }));

  /**
   * Mutation for a member checking IN (logging in)
   */
  const {
    mutate: checkIn,
    isPending: isCheckingIn,
    error: checkInError,
  } = useMutation<CheckInResponse, Error, CheckInVariables>({
    mutationFn: (variables) =>
      apiClient.post("/check-in", variables).then((res) => res.data),

    onSuccess: (data) => {
      // On success, update the global store
      setMemberSession(data.member, data.token);
    },
    onError: (error) => {
      // On error, clear any stale session
      console.error("Check-in failed:", error);
      clearMemberSession();
    },
  });

  /**
   * Mutation for a member checking OUT (logging out)
   */
  const {
    mutate: checkOut,
    isPending: isCheckingOut,
    error: checkOutError,
  } = useMutation<void, Error, CheckOutVariables>({
    mutationFn: (variables) =>
      apiClient.post("/check-out", variables).then((res) => res.data),

    onSuccess: () => {
      // On success, clear the global store
      clearMemberSession();

      // Invalidate any queries that depend on an active session
      queryClient.invalidateQueries({ queryKey: ["attendanceLogs"] });
      queryClient.invalidateQueries({ queryKey: ["active-sales"] });
    },
    onError: (error) => {
      console.error("Check-out failed:", error);
      // You might want to force-clear the session here as well,
      // in case the server failed but the client session is now invalid.
      clearMemberSession();
    },
  });

  return {
    // --- State (from Zustand) ---
    /** The currently logged-in member, or null. */
    currentMember,

    // --- Actions (from Zustand) ---
    /** Call this once on app boot to set the device key. */
    setDeviceKey,

    // --- Check-in Mutation ---
    /** Function to log a member in. */
    checkIn,
    /** True if the check-in request is in flight. */
    isCheckingIn,
    /** The error object if check-in failed. */
    checkInError,

    // --- Check-out Mutation ---
    /** Function to log the current member out. */
    checkOut,
    /** True if the check-out request is in flight. */
    isCheckingOut,
    /** The error object if check-out failed. */
    checkOutError,
  };
}
