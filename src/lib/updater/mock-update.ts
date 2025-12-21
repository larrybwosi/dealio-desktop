/**
 * Mock Update Testing Utilities
 * 
 * This module provides mock implementations of the Tauri updater
 * for testing update flows in development mode.
 */

import type { Update } from '@tauri-apps/plugin-updater';

export interface MockUpdateConfig {
  hasUpdate: boolean;
  version?: string;
  date?: string;
  body?: string;
  isCritical?: boolean;
  downloadDuration?: number; // in ms
  shouldFail?: boolean;
  errorMessage?: string;
}

export interface DownloadProgress {
  event: 'Started' | 'Progress' | 'Finished';
  data: {
    contentLength?: number;
    chunkLength: number;
  };
}

/**
 * Creates a mock Update object that simulates Tauri's update behavior
 */
export function createMockUpdate(config: MockUpdateConfig): Update | null {
  if (!config.hasUpdate) {
    return null;
  }

  const newVersion = config.version || '1.5.0';
  
  let releaseNotes = config.body || `## What's New in v${newVersion}\n\n- Bug fixes and improvements\n- Performance optimizations\n- New features added`;
  
  if (config.isCritical) {
    releaseNotes = `[CRITICAL] ${releaseNotes}`;
  }

  const mockUpdate: Update = {
    version: newVersion,
    date: config.date || new Date().toISOString(),
    body: releaseNotes,
    // @ts-ignore - downloadAndInstall is mocked below
    downloadAndInstall: async (
      onProgress: (progress: DownloadProgress) => void
    ) => {
      return simulateDownload(config, onProgress);
    },
  };

  return mockUpdate;
}

/**
 * Simulates the download and install process
 */
async function simulateDownload(
  config: MockUpdateConfig,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const totalSize = 50 * 1024 * 1024; // 50MB
  const chunkSize = 1024 * 1024; // 1MB chunks
  const duration = config.downloadDuration || 5000; // 5 seconds default
  const chunks = Math.ceil(totalSize / chunkSize);
  const delayPerChunk = duration / chunks;

  // Started event
  onProgress({
    event: 'Started',
    data: {
      contentLength: totalSize,
      chunkLength: 0,
    },
  });

  await sleep(100);

  // Simulate download failure
  if (config.shouldFail) {
    throw new Error(config.errorMessage || 'Mock download failed');
  }

  // Progress events
  for (let i = 0; i < chunks; i++) {
    await sleep(delayPerChunk);
    
    onProgress({
      event: 'Progress',
      data: {
        contentLength: totalSize,
        chunkLength: chunkSize,
      },
    });
  }

  // Finished event
  onProgress({
    event: 'Finished',
    data: {
      contentLength: totalSize,
      chunkLength: 0,
    },
  });

  await sleep(500);
}

/**
 * Mock implementation of the check() function
 */
export async function mockCheck(config: MockUpdateConfig): Promise<Update | null> {
  // Simulate network delay
  await sleep(1000);
  
  return createMockUpdate(config);
}

/**
 * Mock implementation of relaunch()
 */
export async function mockRelaunch(): Promise<void> {
  console.log('🔄 [MOCK] App would relaunch here');
  alert('✅ Update installed successfully!\n\nIn production, the app would restart now.');
}

/**
 * Predefined test scenarios
 */
export const TEST_SCENARIOS = {
  NO_UPDATE: {
    hasUpdate: false,
  },
  
  NORMAL_UPDATE: {
    hasUpdate: true,
    version: '1.5.0',
    body: `## What's New in v1.5.0

### New Features
- Added customer loyalty points tracking
- Improved receipt printing
- Enhanced POS performance

### Bug Fixes
- Fixed pricing sync issues
- Resolved customer display problems

### Improvements
- Better error handling
- Faster startup time`,
    downloadDuration: 5000,
  },
  
  CRITICAL_UPDATE: {
    hasUpdate: true,
    version: '1.5.1',
    isCritical: true,
    body: `[CRITICAL] Security Update Required

## Critical Security Patch v1.5.1

This update addresses critical security vulnerabilities and MUST be installed immediately.

### Security Fixes
- Fixed authentication bypass vulnerability
- Patched SQL injection risk
- Updated dependencies with security patches

**This update is mandatory and cannot be skipped.**`,
    downloadDuration: 3000,
  },
  
  OLD_UPDATE: {
    hasUpdate: true,
    version: '1.4.5',
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    body: `## Update v1.4.5

Your version is severely outdated. Please update immediately.

- Multiple bug fixes
- Security improvements
- Performance enhancements`,
    downloadDuration: 4000,
  },
  
  DOWNLOAD_ERROR: {
    hasUpdate: true,
    version: '1.5.2',
    shouldFail: true,
    errorMessage: 'Network error: Failed to download update package',
    body: `## Update v1.5.2\n\n- Bug fixes\n- Performance improvements`,
  },
  
  SLOW_DOWNLOAD: {
    hasUpdate: true,
    version: '1.5.0',
    body: `## Update v1.5.0\n\n- New features\n- Bug fixes`,
    downloadDuration: 15000, // 15 seconds
  },
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  return (
    import.meta.env.VITE_UPDATE_TEST_MODE === 'true' ||
    localStorage.getItem('update_test_mode') === 'true'
  );
  // return (
  //   import.meta.env.VITE_UPDATE_TEST_MODE === 'true' ||
  //   localStorage.getItem('update_test_mode') === 'true'
  // );
}

/**
 * Get the current test scenario from localStorage
 */
export function getCurrentTestScenario(): keyof typeof TEST_SCENARIOS {
  const scenario = localStorage.getItem('update_test_scenario') as keyof typeof TEST_SCENARIOS;
  return scenario || 'NORMAL_UPDATE';
}

/**
 * Enable/disable test mode
 */
export function setTestMode(enabled: boolean): void {
  localStorage.setItem('update_test_mode', enabled.toString());
}

/**
 * Set the test scenario
 */
export function setTestScenario(scenario: keyof typeof TEST_SCENARIOS): void {
  localStorage.setItem('update_test_scenario', scenario);
}
