import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
// 1. Import Tauri v2's official testing mocks
import { mockWindows, clearMocks } from '@tauri-apps/api/mocks';

// 2. Initialize Tauri v2 Window (Replaces __TAURI_METADATA__)
mockWindows('main');

// 3. Initialize Tauri v2 IPC mock
// We use vi.mock for better integration with Vitest's mocking system
export const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

// Provide a global mock implementation for specific commands if needed
mockInvoke.mockImplementation(async (_cmd, _args) => {
  // console.log(`[MockIPC] ${_cmd}`, _args);
  return undefined;
});

// Prevent Aptabase from attempting background IPC calls
vi.mock('@aptabase/tauri', () => ({
  init: vi.fn(),
  trackEvent: vi.fn(),
}));

// Mock matchMedia for UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Cleanup after each test
afterEach(() => {
  cleanup();
  clearMocks(); // 4. Clear Tauri v2 mock state between tests
  vi.clearAllMocks();
});
