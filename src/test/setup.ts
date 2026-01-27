/**
 * Global test setup for Vitest
 * This file is run before each test file
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Tauri APIs globally
// ============================================================================

vi.mock('@tauri-apps/api', () => import('../__mocks__/@tauri-apps/api'));
vi.mock('@tauri-apps/api/core', () => import('../__mocks__/@tauri-apps/api/core'));
vi.mock('@tauri-apps/plugin-fs', () => import('../__mocks__/@tauri-apps/plugin-fs'));
vi.mock('@tauri-apps/plugin-dialog', () => import('../__mocks__/@tauri-apps/plugin-dialog'));
vi.mock('@tauri-apps/plugin-shell', () => import('../__mocks__/@tauri-apps/plugin-shell'));

// ============================================================================
// Mock fetch globally
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to set mock fetch responses
export const mockFetchResponse = (response: unknown, options?: { ok?: boolean; status?: number }) => {
    mockFetch.mockResolvedValueOnce({
        ok: options?.ok ?? true,
        status: options?.status ?? 200,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
        headers: new Headers({ 'content-type': 'application/json' }),
    });
};

export const mockFetchError = (error: Error) => {
    mockFetch.mockRejectedValueOnce(error);
};

// ============================================================================
// Reset mocks between tests
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    mockFetch.mockReset();
});

// ============================================================================
// Expose mock utilities
// ============================================================================

export { mockFetch };
