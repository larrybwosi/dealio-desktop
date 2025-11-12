// hooks/use-pos-auth.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  setMemberToken,
  setDeviceKey as setGlobalDeviceKey,
} from "@/lib/axios";
import { Member } from "@prisma/client";
import { useState } from "react";

// Define the types for our API responses
interface CheckInResponse {
  member: Member;
  token: string;
}
interface CheckInVariables {
  cardId: string;
  locationId: string;
}
interface CheckOutVariables {
  locationId: string;
}

// We can use a simple state hook or context to hold the current member
// For a real app, React Context or Zustand is better
// But for this example, we'll return setters from the hook.

export function usePosAuth() {
  const queryClient = useQueryClient();

  // These would be managed by a global state (Context/Zustand)
  const [currentMember, setCurrentMember] = useState<Member | null>(null);

  /**
   * Call this function once when the POS device boots up
   * to set its credential.
   */
  const setDeviceKey = (key: string) => {
    setGlobalDeviceKey(key);
  };

  /**
   * Mutation for a member checking IN (logging in)
   */
  const {
    mutate: checkIn,
    isPending: isCheckingIn,
    error: checkInError,
  } = useMutation<CheckInResponse, Error, CheckInVariables>({
    mutationFn: (variables) =>
      apiClient.post("/pos/check-in", variables).then((res) => res.data),

    onSuccess: (data) => {
      // On success, store the member token and update local state
      setMemberToken(data.token);
      setCurrentMember(data.member);
      // You could invalidate other queries here if needed
      // queryClient.invalidateQueries(...);
    },
    onError: () => {
      // Clear any stale state
      setMemberToken(null);
      setCurrentMember(null);
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
      apiClient.post("/pos/check-out", variables).then((res) => res.data),

    onSuccess: () => {
      // On success, clear the member token and local state
      setMemberToken(null);
      setCurrentMember(null);
      // Invalidate attendance logs if you have a query for them
      queryClient.invalidateQueries({ queryKey: ["attendanceLogs"] });
    },
    onError: (error) => {
      console.error("Check-out failed:", error);
      // You might force a logout here anyway
      // setMemberToken(null);
      // setCurrentMember(null);
    },
  });

  return {
    // State
    currentMember,
    isCheckingIn,
    isCheckingOut,
    checkInError,
    checkOutError,

    // Actions
    setDeviceKey, // To initialize the device
    checkIn, // To log a member in
    checkOut, // To log a member out
  };
}
