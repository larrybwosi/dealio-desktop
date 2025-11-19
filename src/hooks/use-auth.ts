import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { usePosAuthStore } from '@/store/pos-auth-store';
import { Member } from '@prisma/client';
import { toast } from 'sonner';

// Types for API mutations
interface CheckInResponse {
  member: Member;
  token: string;
  /** Boolean flag indicating if the member was already checked in */
  restoredSession: boolean;
}

interface CheckInVariables {
  cardId: string;
  locationId: string;
  password?: string; // Optional depending on your auth flow
}

interface CheckOutVariables {
  locationId: string;
}

export function usePosAuth() {
  const queryClient = useQueryClient();

  // Get state and actions directly from the Zustand store
  const { currentMember, memberToken, isRestoredSession, setDeviceKey, setMemberSession, clearMemberSession } =
    usePosAuthStore(state => ({
      currentMember: state.currentMember,
      memberToken: state.memberToken,
      isRestoredSession: state.isRestoredSession,
      setDeviceKey: state.setDeviceKey,
      setMemberSession: state.setMemberSession,
      clearMemberSession: state.clearMemberSession,
    }));

  /**
   * Derived boolean to check if a member is currently authenticated (checked in).
   * Returns true if both the member object and token exist in the store.
   */
  const isAuthenticated = !!currentMember && !!memberToken;

  /**
   * Mutation for a member checking IN (logging in)
   */
  const {
    mutateAsync: checkIn,
    isPending: isCheckingIn,
    error: checkInError,
  } = useMutation<CheckInResponse, Error, CheckInVariables>({
    mutationFn: variables => apiClient.post('/api/v1/pos/check-in', variables).then(res => res.data),

    onSuccess: data => {
      // On success, update the global store with member, token, AND restoration status
      setMemberSession(data.member, data.token, data.restoredSession);

      // Provide context-aware feedback
      if (data.restoredSession) {
        toast.info('Session Restored', {
          description: `${data.member.name} was already checked in.`,
        });
      } else {
        toast.success('Checked in successfully', {
          description: `Welcome, ${data.member.name}`,
        });
      }

      // Invalidate any queries that depend on an active session
      queryClient.invalidateQueries({ queryKey: ['attendanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['active-sales'] });
    },
    onError: error => {
      // On error, clear any stale session
      console.error('Check-in failed:', error);
      toast.error('Failed to check in', {
        description: error.message,
      });
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
    mutationFn: variables => apiClient.post('/api/v1/pos/check-out', variables).then(res => res.data),

    onSuccess: () => {
      // On success, clear the global store
      clearMemberSession();
      toast.success('Checked out successfully');

      // Invalidate any queries that depend on an active session
      queryClient.invalidateQueries({ queryKey: ['attendanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['active-sales'] });
    },
    onError: error => {
      console.error('Check-out failed:', error);
      toast.error('Failed to check out');
      // We usually force clear session even on error to prevent stuck states
      clearMemberSession();
    },
  });

  return {
    /** The currently logged-in member, or null. */
    currentMember,
    /** The current session token, or null. */
    memberToken,
    /** True if the current session was restored from a previous check-in */
    isRestoredSession,
    /** * True if a member is actively authenticated in the POS.
     * (Derived from having both a currentMember and a memberToken)
     */
    isAuthenticated,

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
