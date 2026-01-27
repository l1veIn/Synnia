/**
 * Mock for @tauri-apps/plugin-dialog
 * Provides mock implementations for dialog operations
 */

import { vi } from 'vitest';

// ============================================================================
// Mock return values (can be set in tests)
// ============================================================================

let mockOpenResult: string | string[] | null = null;
let mockSaveResult: string | null = null;
let mockMessageResult: boolean = true;
let mockAskResult: boolean = true;
let mockConfirmResult: boolean = true;

// ============================================================================
// Dialog functions
// ============================================================================

export interface OpenDialogOptions {
    multiple?: boolean;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
    defaultPath?: string;
    title?: string;
}

export interface SaveDialogOptions {
    filters?: Array<{ name: string; extensions: string[] }>;
    defaultPath?: string;
    title?: string;
}

export interface MessageDialogOptions {
    title?: string;
    type?: 'info' | 'warning' | 'error';
    okLabel?: string;
}

export interface ConfirmDialogOptions {
    title?: string;
    type?: 'info' | 'warning' | 'error';
    okLabel?: string;
    cancelLabel?: string;
}

export const open = vi.fn((_options?: OpenDialogOptions) => {
    return Promise.resolve(mockOpenResult);
});

export const save = vi.fn((_options?: SaveDialogOptions) => {
    return Promise.resolve(mockSaveResult);
});

export const message = vi.fn((_message: string, _options?: MessageDialogOptions) => {
    return Promise.resolve(mockMessageResult);
});

export const ask = vi.fn((_message: string, _options?: ConfirmDialogOptions) => {
    return Promise.resolve(mockAskResult);
});

export const confirm = vi.fn((_message: string, _options?: ConfirmDialogOptions) => {
    return Promise.resolve(mockConfirmResult);
});

// ============================================================================
// Test utilities
// ============================================================================

export const __setOpenResult = (result: string | string[] | null) => {
    mockOpenResult = result;
};

export const __setSaveResult = (result: string | null) => {
    mockSaveResult = result;
};

export const __setMessageResult = (result: boolean) => {
    mockMessageResult = result;
};

export const __setAskResult = (result: boolean) => {
    mockAskResult = result;
};

export const __setConfirmResult = (result: boolean) => {
    mockConfirmResult = result;
};

export const __resetDialogMocks = () => {
    mockOpenResult = null;
    mockSaveResult = null;
    mockMessageResult = true;
    mockAskResult = true;
    mockConfirmResult = true;
    
    open.mockClear();
    save.mockClear();
    message.mockClear();
    ask.mockClear();
    confirm.mockClear();
};

export default {
    open,
    save,
    message,
    ask,
    confirm,
    __setOpenResult,
    __setSaveResult,
    __setMessageResult,
    __setAskResult,
    __setConfirmResult,
    __resetDialogMocks,
};
