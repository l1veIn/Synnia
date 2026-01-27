/**
 * Mock for @tauri-apps/api
 * Provides mock implementations for Tauri core APIs
 */

import { vi } from 'vitest';

// ============================================================================
// invoke mock
// ============================================================================

type InvokeHandler = (cmd: string, args?: Record<string, unknown>) => unknown;

let invokeHandler: InvokeHandler = () => undefined;

export const invoke = vi.fn((cmd: string, args?: Record<string, unknown>) => {
    return Promise.resolve(invokeHandler(cmd, args));
});

/**
 * Set a custom handler for invoke calls in tests
 * @example
 * __setInvokeHandler((cmd, args) => {
 *   if (cmd === 'get_settings') return { theme: 'dark' };
 *   return undefined;
 * });
 */
export const __setInvokeHandler = (handler: InvokeHandler) => {
    invokeHandler = handler;
};

export const __resetInvokeHandler = () => {
    invokeHandler = () => undefined;
    invoke.mockClear();
};

// ============================================================================
// event mock
// ============================================================================

type EventCallback = (event: { payload: unknown }) => void;
const eventListeners = new Map<string, Set<EventCallback>>();

export const listen = vi.fn((event: string, callback: EventCallback) => {
    if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);
    
    // Return unlisten function
    return Promise.resolve(() => {
        eventListeners.get(event)?.delete(callback);
    });
});

export const emit = vi.fn((event: string, payload?: unknown) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
        listeners.forEach(cb => cb({ payload }));
    }
    return Promise.resolve();
});

export const __emitMockEvent = (event: string, payload: unknown) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
        listeners.forEach(cb => cb({ payload }));
    }
};

export const __clearEventListeners = () => {
    eventListeners.clear();
    listen.mockClear();
    emit.mockClear();
};

// ============================================================================
// window mock
// ============================================================================

export const window = {
    getCurrent: vi.fn(() => ({
        label: 'main',
        title: vi.fn(() => Promise.resolve('Synnia')),
        setTitle: vi.fn(() => Promise.resolve()),
        close: vi.fn(() => Promise.resolve()),
        minimize: vi.fn(() => Promise.resolve()),
        maximize: vi.fn(() => Promise.resolve()),
        unmaximize: vi.fn(() => Promise.resolve()),
        toggleMaximize: vi.fn(() => Promise.resolve()),
        isMaximized: vi.fn(() => Promise.resolve(false)),
        setFullscreen: vi.fn(() => Promise.resolve()),
        isFullscreen: vi.fn(() => Promise.resolve(false)),
    })),
};

// ============================================================================
// path mock
// ============================================================================

export const path = {
    appDataDir: vi.fn(() => Promise.resolve('/mock/app/data')),
    appConfigDir: vi.fn(() => Promise.resolve('/mock/app/config')),
    appCacheDir: vi.fn(() => Promise.resolve('/mock/app/cache')),
    homeDir: vi.fn(() => Promise.resolve('/mock/home')),
    desktopDir: vi.fn(() => Promise.resolve('/mock/home/Desktop')),
    documentDir: vi.fn(() => Promise.resolve('/mock/home/Documents')),
    downloadDir: vi.fn(() => Promise.resolve('/mock/home/Downloads')),
    join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
    basename: vi.fn((path: string) => Promise.resolve(path.split('/').pop() || '')),
    dirname: vi.fn((path: string) => Promise.resolve(path.split('/').slice(0, -1).join('/'))),
    extname: vi.fn((path: string) => {
        const parts = path.split('.');
        return Promise.resolve(parts.length > 1 ? `.${parts.pop()}` : '');
    }),
};

// ============================================================================
// Default export for module mock
// ============================================================================

export default {
    invoke,
    listen,
    emit,
    window,
    path,
    __setInvokeHandler,
    __resetInvokeHandler,
    __emitMockEvent,
    __clearEventListeners,
};
