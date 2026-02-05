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
    assetId: string;
    relativePath: string;
    thumbnailPath: string | null;
    width: number;
    height: number;
}

/** Media asset info for asset library */
export interface MediaAssetInfo {
    id: string;
    mediaType: string;  // Semantic type: image, video, audio, pdf, file
    name: string;
    content: string;
    thumbnailPath: string | null;
    width: number | null;
    height: number | null;
    createdAt: number;
    updatedAt: number;
}

/** Result for a single file in batch import */
export interface BatchImportResult {
    sourcePath: string;
    result: SaveImageResult | null;
    error: string | null;
}

/** Parameters for getMediaAssets query */
export interface GetMediaAssetsParams {
    ids?: string[];
    mediaType?: 'image' | 'video' | 'audio';
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

/** Response from getMediaAssets */
export interface MediaAssetsResponse {
    items: MediaAssetInfo[];
    total: number;
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

    /**
     * Unified resource import command.
     * @param source - File path, base64 data URL, or HTTP/HTTPS URL
     * @param name - Optional custom name for the asset
     */
    importResource: (source: string, name?: string): Promise<{
        assetId: string;
        mediaType: string;
        mimeType: string;
        relativePath: string;
        thumbnailPath: string | null;
        metadata: { width?: number; height?: number;[key: string]: unknown };
    }> => apiClient.invoke('import_resource', { source, name }),

    /**
     * Get all media assets (images, videos, audio) for the asset library.
     * Supports filtering by IDs, media type, search, and pagination.
     */
    getMediaAssets: (params?: GetMediaAssetsParams): Promise<MediaAssetsResponse> =>
        apiClient.invoke('get_media_assets', { params }),

    /**
     * Batch import multiple files from file system.
     * Returns results for each file, including errors.
     */
    batchImportImages: (filePaths: string[]): Promise<BatchImportResult[]> =>
        apiClient.invoke('batch_import_images', { filePaths }),

    /**
     * Delete a media asset from the database and optionally its physical files.
     * @param assetId - The asset ID to delete
     * @param deleteFiles - Whether to delete the physical files (default: true)
     */
    deleteMediaAsset: (assetId: string, deleteFiles?: boolean): Promise<void> =>
        apiClient.invoke('delete_media_asset', { assetId, deleteFiles }),

    /**
     * Delete orphan media assets that are not referenced by any node.
     * Returns the count and IDs of deleted assets.
     */
    cleanupOrphanAssets: (): Promise<{ deletedCount: number; deletedAssetIds: string[] }> =>
        apiClient.invoke('cleanup_orphan_assets'),

    // ========================================
    // Utility Commands
    // ========================================

    getServerPort: (): Promise<number> =>
        apiClient.invoke('get_server_port'),

    openInBrowser: (url: string): Promise<void> =>
        apiClient.invoke('open_in_browser', { url }),

    // ========================================
    // Recipe Management Commands
    // ========================================

    listRecipeDirectory: (subpath?: string): Promise<import('@/domain/recipe/manifest').DirectoryListing> =>
        apiClient.invoke('list_recipe_directory', { subpath }),

    createRecipe: (recipeId: string, parentPath?: string): Promise<string> =>
        apiClient.invoke('create_recipe', { recipeId, parentPath }),

    createRecipeFolder: (folderName: string, parentPath?: string): Promise<string> =>
        apiClient.invoke('create_recipe_folder', { folderName, parentPath }),

    deleteRecipe: (recipePath: string): Promise<void> =>
        apiClient.invoke('delete_recipe', { recipePath }),

    getRecipeFileTree: (recipePath: string): Promise<import('@/domain/recipe/manifest').FileNode[]> =>
        apiClient.invoke('get_recipe_file_tree', { recipePath }),

    readRecipeFile: (recipePath: string, filePath: string): Promise<string> =>
        apiClient.invoke('read_recipe_file', { recipePath, filePath }),

    writeRecipeFile: (recipePath: string, filePath: string, content: string): Promise<void> =>
        apiClient.invoke('write_recipe_file', { recipePath, filePath, content }),

    createRecipeFile: (recipePath: string, filePath: string): Promise<void> =>
        apiClient.invoke('create_recipe_file', { recipePath, filePath }),

    deleteRecipeFile: (recipePath: string, filePath: string): Promise<void> =>
        apiClient.invoke('delete_recipe_file', { recipePath, filePath }),

    /**
     * Fetch an image from a URL and return it as a base64 data URI.
     * This bypasses CORS restrictions for external image URLs.
     */
    fetchImageAsBase64: (url: string): Promise<{ success: boolean; data?: string; error?: string; contentType?: string }> =>
        apiClient.invoke('fetch_image_as_base64', { url }),

    // ========================================
    // Bot Commands
    // ========================================

    /**
     * Send a chat request to the AI Bot.
     * Returns a response message with optional tool calls.
     */
    botChat: (request: {
        messages: Array<{
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            timestamp: number;
            toolCalls?: unknown[];
            metadata?: Record<string, unknown>;
        }>;
        systemPrompt: string;
        tools: Array<{
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        }>;
        modelId?: string;
    }): Promise<{
        message: {
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            timestamp: number;
        };
        toolCalls?: unknown[];
    }> => apiClient.invoke('bot_chat', { request }),

    /**
     * Save bot chat history to disk.
     * Stores conversation in {project}/.synnia/chat/{session_id}.json
     */
    saveBotHistory: (request: {
        sessionId: string;
        messages: Array<{
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            timestamp: number;
            toolCalls?: unknown[];
            metadata?: Record<string, unknown>;
        }>;
    }): Promise<void> => apiClient.invoke('save_bot_history', { request }),

    /**
     * Load bot chat history from disk.
     * If sessionId is not provided, loads the most recent session.
     */
    loadBotHistory: (sessionId?: string): Promise<{
        session: {
            id: string;
            createdAt: number;
            updatedAt: number;
            messages: Array<{
                id: string;
                role: 'user' | 'assistant' | 'system';
                content: string;
                timestamp: number;
                toolCalls?: unknown[];
                metadata?: Record<string, unknown>;
            }>;
        } | null;
    } | null> => apiClient.invoke('load_bot_history', sessionId ? { sessionId } : {}),

    /**
     * List all bot chat sessions.
     */
    listBotSessions: (): Promise<Array<{
        id: string;
        createdAt: number;
        updatedAt: number;
        messageCount: number;
    }>> => apiClient.invoke('list_bot_sessions'),

    /**
     * Delete a bot chat session.
     */
    deleteBotSession: (sessionId: string): Promise<void> =>
        apiClient.invoke('delete_bot_session', { sessionId }),
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
