import { Mock } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// Type helper for the mocked invoke function
export const mockInvoke = invoke as Mock;

// Helper to setup a specific response for a command
export const mockCommand = (cmd: string, response: any) => {
  mockInvoke.mockImplementation(async (invokedCmd: string, args: any) => {
    if (invokedCmd === cmd) {
      if (typeof response === 'function') {
        return response(args);
      }
      return response;
    }
    return undefined;
  });
};

// Reset all mocks
export const resetMocks = () => {
  mockInvoke.mockReset();
};
