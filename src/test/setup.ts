import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import * as tauriMocks from './mocks/tauri';

// Mock Tauri API
// This must remain a top-level mock to be hoisted correctly by Vitest
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  // Add other Tauri APIs here as needed
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
  vi.clearAllMocks();
});

// Helper to reset Tauri mocks
export const resetTauriMocks = () => {
    tauriMocks.resetMocks();
};
