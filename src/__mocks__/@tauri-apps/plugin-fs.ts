/**
 * Mock for @tauri-apps/plugin-fs
 * Provides mock implementations for file system operations
 */

import { vi } from 'vitest';

// ============================================================================
// Mock file system storage
// ============================================================================

const mockFileSystem = new Map<string, string | Uint8Array>();
const mockDirectories = new Set<string>(['/mock']);

// ============================================================================
// File operations
// ============================================================================

export const readTextFile = vi.fn((path: string) => {
    const content = mockFileSystem.get(path);
    if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
    }
    if (content instanceof Uint8Array) {
        return Promise.resolve(new TextDecoder().decode(content));
    }
    return Promise.resolve(content);
});

export const writeTextFile = vi.fn((path: string, contents: string) => {
    mockFileSystem.set(path, contents);
    return Promise.resolve();
});

export const readFile = vi.fn((path: string) => {
    const content = mockFileSystem.get(path);
    if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
    }
    if (typeof content === 'string') {
        return Promise.resolve(new TextEncoder().encode(content));
    }
    return Promise.resolve(content);
});

export const writeFile = vi.fn((path: string, contents: Uint8Array) => {
    mockFileSystem.set(path, contents);
    return Promise.resolve();
});

export const exists = vi.fn((path: string) => {
    return Promise.resolve(mockFileSystem.has(path) || mockDirectories.has(path));
});

export const remove = vi.fn((path: string) => {
    mockFileSystem.delete(path);
    mockDirectories.delete(path);
    return Promise.resolve();
});

export const rename = vi.fn((oldPath: string, newPath: string) => {
    const content = mockFileSystem.get(oldPath);
    if (content !== undefined) {
        mockFileSystem.set(newPath, content);
        mockFileSystem.delete(oldPath);
    }
    return Promise.resolve();
});

export const copyFile = vi.fn((source: string, destination: string) => {
    const content = mockFileSystem.get(source);
    if (content !== undefined) {
        mockFileSystem.set(destination, content);
    }
    return Promise.resolve();
});

// ============================================================================
// Directory operations
// ============================================================================

export const mkdir = vi.fn((path: string) => {
    mockDirectories.add(path);
    return Promise.resolve();
});

export const readDir = vi.fn((path: string) => {
    const entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }> = [];
    
    // Find all entries in this directory
    const prefix = path.endsWith('/') ? path : `${path}/`;
    
    mockFileSystem.forEach((_, filePath) => {
        if (filePath.startsWith(prefix)) {
            const relativePath = filePath.slice(prefix.length);
            const name = relativePath.split('/')[0];
            if (name && !entries.find(e => e.name === name)) {
                entries.push({
                    name,
                    isDirectory: relativePath.includes('/'),
                    isFile: !relativePath.includes('/'),
                });
            }
        }
    });
    
    mockDirectories.forEach(dirPath => {
        if (dirPath.startsWith(prefix) && dirPath !== path) {
            const relativePath = dirPath.slice(prefix.length);
            const name = relativePath.split('/')[0];
            if (name && !entries.find(e => e.name === name)) {
                entries.push({
                    name,
                    isDirectory: true,
                    isFile: false,
                });
            }
        }
    });
    
    return Promise.resolve(entries);
});

// ============================================================================
// Test utilities
// ============================================================================

export const __setMockFile = (path: string, content: string | Uint8Array) => {
    mockFileSystem.set(path, content);
};

export const __setMockDirectory = (path: string) => {
    mockDirectories.add(path);
};

export const __clearMockFileSystem = () => {
    mockFileSystem.clear();
    mockDirectories.clear();
    mockDirectories.add('/mock');
    
    readTextFile.mockClear();
    writeTextFile.mockClear();
    readFile.mockClear();
    writeFile.mockClear();
    exists.mockClear();
    remove.mockClear();
    rename.mockClear();
    copyFile.mockClear();
    mkdir.mockClear();
    readDir.mockClear();
};

export const __getMockFileSystem = () => new Map(mockFileSystem);

// ============================================================================
// BaseDirectory enum (matches Tauri's)
// ============================================================================

export enum BaseDirectory {
    Audio = 1,
    Cache = 2,
    Config = 3,
    Data = 4,
    LocalData = 5,
    Document = 6,
    Download = 7,
    Picture = 8,
    Public = 9,
    Video = 10,
    Resource = 11,
    Temp = 12,
    AppConfig = 13,
    AppData = 14,
    AppLocalData = 15,
    AppCache = 16,
    AppLog = 17,
    Desktop = 18,
    Executable = 19,
    Font = 20,
    Home = 21,
    Runtime = 22,
    Template = 23,
}

export default {
    readTextFile,
    writeTextFile,
    readFile,
    writeFile,
    exists,
    remove,
    rename,
    copyFile,
    mkdir,
    readDir,
    BaseDirectory,
    __setMockFile,
    __setMockDirectory,
    __clearMockFileSystem,
    __getMockFileSystem,
};
