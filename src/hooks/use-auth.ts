import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Member, useAuthStore } from '@/store/pos-auth-store';
import { toast } from 'sonner';
import { useCallback, useEffect } from 'react';
import throttle from 'lodash/throttle';


// Types for API mutations
interface CheckInResponse {
  member: Member;
  restoredSession: boolean;
}

interface CheckInVariables {
  cardId: string;
  password?: string; // Optional depending on your auth flow
}


export function useAuth() {
  const queryClient = useQueryClient();
  
  // Get state and actions directly from the Zustand store
  const { currentMember, currentLocation, isRestoredSession, setDeviceKey, setMemberSession, clearMemberSession } =
    useAuthStore(state => ({
      currentMember: state.currentMember,
      isRestoredSession: state.isRestoredSession,
      setDeviceKey: state.setDeviceKey,
      setMemberSession: state.setMemberSession,
      clearMemberSession: state.clearMemberSession,
      currentLocation: state.currentLocation
    }));

  /**
   * Derived boolean to check if a member is currently authenticated (checked in).
   * Returns true if both the member object and token exist in the store.
   */
  const isAuthenticated = !!currentMember;

  /**
   * Mutation for a member checking IN (logging in)
   */
  const {
    mutateAsync: checkIn,
    isPending: isCheckingIn,
    error: checkInError,
  } = useMutation<CheckInResponse, Error, CheckInVariables>({
    mutationFn: variables =>
      invoke<CheckInResponse>('login_member', { 
        cardId: variables.cardId, 
        pin: variables.password, 
        locationId: currentLocation?.id 
      }),
    onSuccess: data => {
      // On success, update the global store with member AND restoration status
      setMemberSession(data.member, data.restoredSession);

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
  } = useMutation<void, Error>({
    mutationFn: () => invoke('logout_member', { locationId: currentLocation?.id }),

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
    currentMember,
    memberToken: null,
    isRestoredSession,
    isAuthenticated,
    setDeviceKey,
    checkIn,
    isCheckingIn,
    checkInError,
    checkOut,
    isCheckingOut,
    checkOutError,
    currentLocation,
  };
}

export const useSessionActivityListener = () => {
  const refreshSession = useAuthStore(state => state.refreshSession);
  const currentMember = useAuthStore(state => state.currentMember);

  // Throttled function to prevent too many state updates.
  // It will only fire once every 5 seconds max, even if the user is typing furiously.
  const handleActivity = useCallback(
    throttle(() => {
      if (currentMember) {
        refreshSession();
      }
    }, 5000),
    [currentMember, refreshSession]
  );

  useEffect(() => {
    if (!currentMember) return;

    // Events that constitute "activity"
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    // Add listeners
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Cleanup
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      handleActivity.cancel(); // If using lodash throttle
    };
  }, [currentMember, handleActivity]);
};