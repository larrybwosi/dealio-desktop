import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../pos-auth-store';
import { mockInvoke } from '@/test/mocks/tauri';

// Mock API_ENDPOINT
vi.mock('@/lib/axios', () => ({
  API_ENDPOINT: 'http://localhost:3000'
}));

describe('PosAuthStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.getState().resetAll();
    vi.clearAllMocks();
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ locations: [{ id: 'loc-1', name: 'Test Location' }] }),
    });
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.deviceKey).toBeNull();
    expect(state.currentMember).toBeNull();
    expect(state.isInitialized).toBe(false);
  });

  it('should set device key', async () => {
    await useAuthStore.getState().setDeviceKey('test-key');
    expect(useAuthStore.getState().deviceKey).toBe('test-key');
  });

  it('should set member session', () => {
    const member = { 
        id: '1', 
        name: 'Test User',
        organizationId: 'org-1',
        userId: 'user-1',
        isActive: true,
        image: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        phone: null,
        email: null,
        address: null,
        age: null,
        gender: null,
        tags: null,
        cardId: null,
        isCheckedIn: false,
        lastCheckInTime: null,
        currentCheckInLocationId: null,
        currentAttendanceLogId: null
    };
    
    useAuthStore.getState().setMemberSession(member);
    
    expect(useAuthStore.getState().currentMember).toEqual(member);
    expect(useAuthStore.getState().sessionUpdatedAt).toBeDefined();
  });

  it('should clear member session', () => {
     const member = { 
        id: '1', 
        name: 'Test User',
        organizationId: 'org-1',
        userId: 'user-1',
        isActive: true,
        image: ''
    } as any;
    useAuthStore.getState().setMemberSession(member);
    useAuthStore.getState().clearMemberSession();

    expect(useAuthStore.getState().currentMember).toBeNull();
    expect(useAuthStore.getState().sessionUpdatedAt).toBeNull();
  });

  it('should initialize from backend successfully', async () => {
    mockInvoke.mockResolvedValueOnce({
      device_key: 'backend-key',
      location_id: 'loc-1',
      base_url: 'http://api'
    });

    await useAuthStore.getState().initializeFromBackend();

    expect(useAuthStore.getState().deviceKey).toBe('backend-key');
    expect(mockInvoke).toHaveBeenCalledWith('get_device_config');
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('should handle backend initialization failure gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Failed'));

    await useAuthStore.getState().initializeFromBackend();

    expect(useAuthStore.getState().isInitialized).toBe(true); // Should still mark initialized
    expect(useAuthStore.getState().deviceKey).toBeNull();
  });
});
