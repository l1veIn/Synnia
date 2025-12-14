/**
 * Synnia API Client
 * 
 * Provides a typed wrapper around Tauri invoke commands.
 * Includes mock implementations for browser-only development.
 */

import { SynniaProject } from '@/bindings';
import { invoke } from '@tauri-apps/api/core';

// ============================================
// Types
// ============================================

/** Asset history entry from backend */
export interface AssetHistoryEntry {
    id: number;
    assetId: string;
    contentHash: string;
    contentPreview: string;
    createdAt: number;
}

/** Recent project entry */
export interface RecentProject {
    name: string;
    path: string;
    last_opened: string;
}

/** Result from saving an image file */
export interface SaveImageResult {
    relativePath: string;
    thumbnailPath: string | null;
    width: number;
    height: number;
}

/** Media asset info for asset library */
export interface MediaAssetInfo {
    id: string;
    assetType: string;
    name: string;
    content: string;
    thumbnailPath: string | null;
    width: number | null;
    height: number | null;
    createdAt: number;
    updatedAt: number;
}

// ============================================
// Environment Detection
// ============================================

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ============================================
// API Client
// ============================================

export const apiClient = {
    /**
     * Universal Tauri invoke wrapper with error handling.
     */
    invoke: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        if (isTauri) {
            try {
                return await invoke<T>(cmd, args);
            } catch (e) {
                console.error(`[Tauri] Command '${cmd}' failed:`, e);
                throw e;
            }
        }

        // Mock fallback for browser development
        console.warn(`[MockAPI] ${cmd}`, args);
        await delay(100);
        return getMockResponse<T>(cmd, args);
    },

    // ========================================
    // Project Commands
    // ========================================

    loadProject: (path: string): Promise<SynniaProject> =>
        apiClient.invoke('load_project', { path }),

    saveProject: (project: SynniaProject): Promise<void> =>
        apiClient.invoke('save_project', { project }),

    saveProjectAutosave: (project: SynniaProject): Promise<void> =>
        apiClient.invoke('save_project_autosave', { project }),

    createProject: (name: string, parentPath: string): Promise<string> =>
        apiClient.invoke('create_project', { name, parentPath }),

    deleteProject: (path: string): Promise<void> =>
        apiClient.invoke('delete_project', { path }),

    renameProject: (oldPath: string, newName: string): Promise<string> =>
        apiClient.invoke('rename_project', { oldPath, newName }),

    getRecentProjects: (): Promise<RecentProject[]> =>
        apiClient.invoke('get_recent_projects'),

    getDefaultProjectsPath: (): Promise<string> =>
        apiClient.invoke('get_default_projects_path'),

    getCurrentProjectPath: (): Promise<string> =>
        apiClient.invoke('get_current_project_path'),

    // ========================================
    // Asset History Commands
    // ========================================

    /**
     * Get version history for an asset.
     * @param assetId - The asset ID
     * @param limit - Max entries to return (default 50)
     */
    getAssetHistory: (assetId: string, limit?: number): Promise<AssetHistoryEntry[]> =>
        apiClient.invoke('get_asset_history', { assetId, limit }),

    /**
     * Get full content JSON of a specific history version.
     */
    getHistoryContent: (historyId: number): Promise<string> =>
        apiClient.invoke('get_history_content', { historyId }),

    /**
     * Restore an asset to a previous version.
     * @returns The restored content as JSON value
     */
    restoreAssetVersion: (assetId: string, historyId: number): Promise<unknown> =>
        apiClient.invoke('restore_asset_version', { assetId, historyId }),

    /**
     * Count total history entries for an asset.
     */
    countAssetHistory: (assetId: string): Promise<number> =>
        apiClient.invoke('count_asset_history', { assetId }),

    // ========================================
    // Asset Commands
    // ========================================

    /** Result from saving an image file */
    importFile: (filePath: string): Promise<SaveImageResult> =>
        apiClient.invoke('import_file', { filePath }),

    /**
     * Save a processed image from base64 data.
     * After image editing (crop, rotate, bg removal), call this to persist.
     */
    saveProcessedImage: (base64Data: string, filename?: string): Promise<SaveImageResult> =>
        apiClient.invoke('save_processed_image', { base64Data, filename }),

    /**
     * Get all media assets (images, videos, audio) for the asset library.
     */
    getMediaAssets: (): Promise<MediaAssetInfo[]> =>
        apiClient.invoke('get_media_assets', {}),

    // ========================================
    // Utility Commands
    // ========================================

    getServerPort: (): Promise<number> =>
        apiClient.invoke('get_server_port'),

    openInBrowser: (url: string): Promise<void> =>
        apiClient.invoke('open_in_browser', { url }),
};

// ============================================
// Helpers
// ============================================

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock responses for browser development.
 */
function getMockResponse<T>(cmd: string, _args?: Record<string, unknown>): T {
    switch (cmd) {
        case 'get_recent_projects':
            return [] as T;
        case 'get_default_projects_path':
            return '/Mock/Documents/SynniaProjects' as T;
        case 'get_asset_history':
            return [
                { id: 1, assetId: 'mock', contentHash: 'abc123', contentPreview: '{"mock": true}', createdAt: Date.now() - 60000 },
                { id: 2, assetId: 'mock', contentHash: 'def456', contentPreview: '{"mock": false}', createdAt: Date.now() }
            ] as T;
        case 'get_history_content':
            return '{"mock": "content"}' as T;
        case 'count_asset_history':
            return 2 as T;
        case 'get_server_port':
            return 3001 as T;
        default:
            return null as T;
    }
}
