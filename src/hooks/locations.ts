// hooks/use-pos-config.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { LocationType } from '@prisma/client'; // Ensure you have types generated

export interface PosLocation {
  id: string;
  name: string;
  code: string | null;
  locationType: LocationType;
  address: any; // Type this strictly if your Json address schema is known
  isDefault: boolean;
}

interface LocationsResponse {
  locations: PosLocation[];
}

export function usePosLocations() {
  /**
   * Fetches all available locations for the authenticated organization.
   * This query depends on the Device API Key being set in the global store.
   */
  const { data, isLoading, error, refetch } = useQuery<LocationsResponse, Error>({
    queryKey: ['pos-locations'],
    queryFn: () => apiClient.get('/api/v1/pos/locations').then(res => res.data),
    // Only run this query if we are on the client (avoids SSR issues with localStorage)
    enabled: typeof window !== 'undefined',
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (locations rarely change)
  });

  return {
    locations: data?.locations || [],
    isLoading,
    error,
    refetchLocations: refetch,
  };
}
