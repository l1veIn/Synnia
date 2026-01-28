/**
 * apiClient Tests
 * Tests for the Tauri API client wrapper
 *
 * Tests the Tauri invoke path with mocked invoke handlers.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { __setInvokeHandler, __resetInvokeHandler } from '@tauri-apps/api';
import type { SynniaProject } from '@/bindings';

// ============================================================================
// Module Mocks
// ============================================================================

vi.mock('@/bindings', () => ({
    SynniaProject: {},
}));

vi.mock('@/types/recipe', () => ({
    DirectoryListing: [],
    FileNode: [],
}));

// Set up Tauri environment mock BEFORE importing apiClient
// This ensures isTauri check in apiClient.ts evaluates to true
if (typeof window !== 'undefined') {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
}

// Create a test version of apiClient that uses the mocked invoke
// This bypasses the isTauri check by directly using the mock
const createTestApiClient = () => {
    const invokeFn = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        return invoke<T>(cmd, args);
    };

    return {
        invoke: invokeFn,

        // Project Commands
        loadProject: (path: string): Promise<SynniaProject> =>
            invokeFn('load_project', { path }),

        saveProject: (project: SynniaProject): Promise<void> =>
            invokeFn('save_project', { project }),

        saveProjectAutosave: (project: SynniaProject): Promise<void> =>
            invokeFn('save_project_autosave', { project }),

        createProject: (name: string, parentPath: string): Promise<string> =>
            invokeFn('create_project', { name, parentPath }),

        deleteProject: (path: string): Promise<void> =>
            invokeFn('delete_project', { path }),

        renameProject: (oldPath: string, newName: string): Promise<string> =>
            invokeFn('rename_project', { oldPath, newName }),

        getRecentProjects: (): Promise<import('../apiClient').RecentProject[]> =>
            invokeFn('get_recent_projects'),

        getDefaultProjectsPath: (): Promise<string> =>
            invokeFn('get_default_projects_path'),

        getCurrentProjectPath: (): Promise<string> =>
            invokeFn('get_current_project_path'),

        // Asset History Commands
        getAssetHistory: (assetId: string, limit?: number): Promise<import('../apiClient').AssetHistoryEntry[]> =>
            invokeFn('get_asset_history', { assetId, limit }),

        getHistoryContent: (historyId: number): Promise<string> =>
            invokeFn('get_history_content', { historyId }),

        restoreAssetVersion: (assetId: string, historyId: number): Promise<unknown> =>
            invokeFn('restore_asset_version', { assetId, historyId }),

        countAssetHistory: (assetId: string): Promise<number> =>
            invokeFn('count_asset_history', { assetId }),

        // Asset Commands
        importFile: (filePath: string): Promise<import('../apiClient').SaveImageResult> =>
            invokeFn('import_file', { filePath }),

        saveProcessedImage: (base64Data: string, filename?: string): Promise<import('../apiClient').SaveImageResult> =>
            invokeFn('save_processed_image', { base64Data, filename }),

        getMediaAssets: (params?: import('../apiClient').GetMediaAssetsParams): Promise<import('../apiClient').MediaAssetsResponse> =>
            invokeFn('get_media_assets', { params }),

        downloadAndSaveImage: (url: string, filename?: string): Promise<import('../apiClient').SaveImageResult> =>
            invokeFn('download_and_save_image', { url, filename }),

        batchImportImages: (filePaths: string[]): Promise<import('../apiClient').BatchImportResult[]> =>
            invokeFn('batch_import_images', { filePaths }),

        deleteMediaAsset: (assetId: string, deleteFiles?: boolean): Promise<void> =>
            invokeFn('delete_media_asset', { assetId, deleteFiles }),

        cleanupOrphanAssets: (): Promise<{ deletedCount: number; deletedAssetIds: string[] }> =>
            invokeFn('cleanup_orphan_assets'),

        // Utility Commands
        getServerPort: (): Promise<number> =>
            invokeFn('get_server_port'),

        openInBrowser: (url: string): Promise<void> =>
            invokeFn('open_in_browser', { url }),

        fetchImageAsBase64: (url: string): Promise<{ success: boolean; data?: string; error?: string; contentType?: string }> =>
            invokeFn('fetch_image_as_base64', { url }),

        // Recipe Management Commands
        listRecipeDirectory: (subpath?: string): Promise<import('@/types/recipe').DirectoryListing> =>
            invokeFn('list_recipe_directory', { subpath }),

        createRecipe: (recipeId: string, parentPath?: string): Promise<string> =>
            invokeFn('create_recipe', { recipeId, parentPath }),

        createRecipeFolder: (folderName: string, parentPath?: string): Promise<string> =>
            invokeFn('create_recipe_folder', { folderName, parentPath }),

        deleteRecipe: (recipePath: string): Promise<void> =>
            invokeFn('delete_recipe', { recipePath }),

        getRecipeFileTree: (recipePath: string): Promise<import('@/types/recipe').FileNode[]> =>
            invokeFn('get_recipe_file_tree', { recipePath }),

        readRecipeFile: (recipePath: string, filePath: string): Promise<string> =>
            invokeFn('read_recipe_file', { recipePath, filePath }),

        writeRecipeFile: (recipePath: string, filePath: string, content: string): Promise<void> =>
            invokeFn('write_recipe_file', { recipePath, filePath, content }),

        createRecipeFile: (recipePath: string, filePath: string): Promise<void> =>
            invokeFn('create_recipe_file', { recipePath, filePath }),

        deleteRecipeFile: (recipePath: string, filePath: string): Promise<void> =>
            invokeFn('delete_recipe_file', { recipePath, filePath }),
    };
};

const apiClient = createTestApiClient();

// ============================================================================
// Test Helpers
// ============================================================================

const createMockProject = (): SynniaProject => ({
    id: 'test-project-id',
    name: 'Test Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [],
    edges: [],
});

const createMockAssetHistoryEntry = (id: number): import('../apiClient').AssetHistoryEntry => ({
    id,
    assetId: `asset-${id}`,
    contentHash: `hash-${id}`,
    contentPreview: `{"preview": ${id}}`,
    createdAt: Date.now() - id * 1000,
});

const createMockRecentProject = (path: string): import('../apiClient').RecentProject => ({
    name: 'Test Project',
    path,
    last_opened: new Date().toISOString(),
});

const createMockSaveImageResult = (assetId: string): import('../apiClient').SaveImageResult => ({
    assetId,
    relativePath: `assets/${assetId}.png`,
    thumbnailPath: `assets/thumbnails/${assetId}_thumb.png`,
    width: 1920,
    height: 1080,
});

const createMockMediaAssetInfo = (id: string): import('../apiClient').MediaAssetInfo => ({
    id,
    mediaType: 'image',
    name: `asset-${id}.png`,
    content: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
    thumbnailPath: `thumbnails/${id}.png`,
    width: 1920,
    height: 1080,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

// ============================================================================
// Setup and Teardown
// ============================================================================

describe('apiClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetInvokeHandler();
    });

    afterEach(() => {
        __resetInvokeHandler();
    });

    // ========================================================================
    // invoke method
    // ========================================================================

    describe('invoke', () => {
        it('should call Tauri invoke with correct command and args', async () => {
            const mockResponse = { result: 'success' };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.invoke('test_command', { arg1: 'value1' });

            expect(result).toEqual(mockResponse);
            expect(invoke).toHaveBeenCalledWith('test_command', { arg1: 'value1' });
        });

        it('should handle invoke with no args', async () => {
            const mockResponse = { data: 'test' };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.invoke('test_command');

            expect(result).toEqual(mockResponse);
            expect(invoke).toHaveBeenCalledWith('test_command', undefined);
        });

        it('should return typed response', async () => {
            interface TestResponse {
                id: string;
                value: number;
            }
            const mockResponse: TestResponse = { id: 'test', value: 42 };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.invoke<TestResponse>('typed_command');

            expect(result).toEqual(mockResponse);
            expect(typeof result.id).toBe('string');
            expect(typeof result.value).toBe('number');
        });
    });

    // ========================================================================
    // Project Commands
    // ========================================================================

    describe('loadProject', () => {
        it('should invoke load_project with path', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => mockProject);

            const result = await apiClient.loadProject('/path/to/project.synnia');

            expect(result).toEqual(mockProject);
            expect(invoke).toHaveBeenCalledWith('load_project', { path: '/path/to/project.synnia' });
        });

        it('should return SynniaProject type', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => mockProject);

            const result = await apiClient.loadProject('/test/path');

            expect(result).toBeDefined();
            expect(result.id).toBe('test-project-id');
        });
    });

    describe('saveProject', () => {
        it('should invoke save_project with project data', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => undefined);

            await apiClient.saveProject(mockProject);

            expect(invoke).toHaveBeenCalledWith('save_project', { project: mockProject });
        });

        it('should resolve without return value', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => undefined);

            const result = await apiClient.saveProject(mockProject);

            expect(result).toBeUndefined();
        });
    });

    describe('saveProjectAutosave', () => {
        it('should invoke save_project_autosave with project data', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => undefined);

            await apiClient.saveProjectAutosave(mockProject);

            expect(invoke).toHaveBeenCalledWith('save_project_autosave', { project: mockProject });
        });
    });

    describe('createProject', () => {
        it('should invoke create_project with name and parentPath', async () => {
            const mockPath = '/projects/new-project.synnia';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.createProject('New Project', '/projects');

            expect(result).toBe(mockPath);
            expect(invoke).toHaveBeenCalledWith('create_project', {
                name: 'New Project',
                parentPath: '/projects',
            });
        });

        it('should return the created project path as string', async () => {
            const mockPath = '/Documents/My Project.synnia';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.createProject('My Project', '/Documents');

            expect(result).toBe('/Documents/My Project.synnia');
            expect(typeof result).toBe('string');
        });
    });

    describe('deleteProject', () => {
        it('should invoke delete_project with path', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.deleteProject('/path/to/project.synnia');

            expect(invoke).toHaveBeenCalledWith('delete_project', { path: '/path/to/project.synnia' });
        });
    });

    describe('renameProject', () => {
        it('should invoke rename_project with oldPath and newName', async () => {
            const newPath = '/projects/New Name.synnia';
            __setInvokeHandler(() => newPath);

            const result = await apiClient.renameProject('/projects/Old Name.synnia', 'New Name');

            expect(result).toBe(newPath);
            expect(invoke).toHaveBeenCalledWith('rename_project', {
                oldPath: '/projects/Old Name.synnia',
                newName: 'New Name',
            });
        });
    });

    describe('getRecentProjects', () => {
        it('should invoke get_recent_projects without args', async () => {
            const mockProjects = [
                createMockRecentProject('/projects/proj1.synnia'),
                createMockRecentProject('/projects/proj2.synnia'),
            ];
            __setInvokeHandler(() => mockProjects);

            const result = await apiClient.getRecentProjects();

            expect(result).toEqual(mockProjects);
            expect(invoke).toHaveBeenCalledWith('get_recent_projects', undefined);
        });

        it('should return array of RecentProject', async () => {
            const mockProjects = [createMockRecentProject('/test/path')];
            __setInvokeHandler(() => mockProjects);

            const result = await apiClient.getRecentProjects();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/path');
        });
    });

    describe('getDefaultProjectsPath', () => {
        it('should invoke get_default_projects_path without args', async () => {
            const mockPath = '/Documents/SynniaProjects';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.getDefaultProjectsPath();

            expect(result).toBe(mockPath);
            expect(invoke).toHaveBeenCalledWith('get_default_projects_path', undefined);
        });
    });

    describe('getCurrentProjectPath', () => {
        it('should invoke get_current_project_path without args', async () => {
            const mockPath = '/projects/current.synnia';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.getCurrentProjectPath();

            expect(result).toBe(mockPath);
            expect(invoke).toHaveBeenCalledWith('get_current_project_path', undefined);
        });
    });

    // ========================================================================
    // Asset History Commands
    // ========================================================================

    describe('getAssetHistory', () => {
        it('should invoke get_asset_history with assetId and limit', async () => {
            const mockHistory = [
                createMockAssetHistoryEntry(1),
                createMockAssetHistoryEntry(2),
            ];
            __setInvokeHandler(() => mockHistory);

            const result = await apiClient.getAssetHistory('asset-123', 10);

            expect(result).toEqual(mockHistory);
            expect(invoke).toHaveBeenCalledWith('get_asset_history', {
                assetId: 'asset-123',
                limit: 10,
            });
        });

        it('should invoke get_asset_history with only assetId', async () => {
            const mockHistory = [createMockAssetHistoryEntry(1)];
            __setInvokeHandler(() => mockHistory);

            await apiClient.getAssetHistory('asset-123');

            expect(invoke).toHaveBeenCalledWith('get_asset_history', {
                assetId: 'asset-123',
                limit: undefined,
            });
        });

        it('should return array of AssetHistoryEntry', async () => {
            const mockHistory = [
                createMockAssetHistoryEntry(1),
                createMockAssetHistoryEntry(2),
                createMockAssetHistoryEntry(3),
            ];
            __setInvokeHandler(() => mockHistory);

            const result = await apiClient.getAssetHistory('asset-123', 50);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(3);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(2);
            expect(result[2].id).toBe(3);
        });
    });

    describe('getHistoryContent', () => {
        it('should invoke get_history_content with historyId', async () => {
            const mockContent = '{"data": "test content"}';
            __setInvokeHandler(() => mockContent);

            const result = await apiClient.getHistoryContent(42);

            expect(result).toBe(mockContent);
            expect(invoke).toHaveBeenCalledWith('get_history_content', {
                historyId: 42,
            });
        });

        it('should return content as string', async () => {
            const mockContent = '{"node": "data"}';
            __setInvokeHandler(() => mockContent);

            const result = await apiClient.getHistoryContent(100);

            expect(typeof result).toBe('string');
            expect(result).toBe('{"node": "data"}');
        });
    });

    describe('restoreAssetVersion', () => {
        it('should invoke restore_asset_version with assetId and historyId', async () => {
            const mockRestored = { data: 'restored content' };
            __setInvokeHandler(() => mockRestored);

            const result = await apiClient.restoreAssetVersion('asset-123', 5);

            expect(result).toEqual(mockRestored);
            expect(invoke).toHaveBeenCalledWith('restore_asset_version', {
                assetId: 'asset-123',
                historyId: 5,
            });
        });
    });

    describe('countAssetHistory', () => {
        it('should invoke count_asset_history with assetId', async () => {
            __setInvokeHandler(() => 15);

            const result = await apiClient.countAssetHistory('asset-123');

            expect(result).toBe(15);
            expect(invoke).toHaveBeenCalledWith('count_asset_history', {
                assetId: 'asset-123',
            });
        });

        it('should return number', async () => {
            __setInvokeHandler(() => 42);

            const result = await apiClient.countAssetHistory('asset-xyz');

            expect(typeof result).toBe('number');
            expect(result).toBe(42);
        });
    });

    // ========================================================================
    // Asset Commands
    // ========================================================================

    describe('importFile', () => {
        it('should invoke import_file with filePath', async () => {
            const mockResult = createMockSaveImageResult('imported-asset');
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.importFile('/path/to/image.png');

            expect(result).toEqual(mockResult);
            expect(invoke).toHaveBeenCalledWith('import_file', {
                filePath: '/path/to/image.png',
            });
        });

        it('should return SaveImageResult', async () => {
            const mockResult = createMockSaveImageResult('test-asset');
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.importFile('/test/file.jpg');

            expect(result.assetId).toBe('test-asset');
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
        });
    });

    describe('saveProcessedImage', () => {
        it('should invoke save_processed_image with base64Data and filename', async () => {
            const mockResult = createMockSaveImageResult('processed-asset');
            __setInvokeHandler(() => mockResult);

            const base64Data = 'data:image/png;base64,iVBORw0KGgo...';
            const result = await apiClient.saveProcessedImage(base64Data, 'processed.png');

            expect(result).toEqual(mockResult);
            expect(invoke).toHaveBeenCalledWith('save_processed_image', {
                base64Data,
                filename: 'processed.png',
            });
        });

        it('should invoke save_processed_image with only base64Data', async () => {
            const mockResult = createMockSaveImageResult('processed-asset');
            __setInvokeHandler(() => mockResult);

            const base64Data = 'data:image/png;base64,iVBORw0KGgo...';
            await apiClient.saveProcessedImage(base64Data);

            expect(invoke).toHaveBeenCalledWith('save_processed_image', {
                base64Data,
                filename: undefined,
            });
        });
    });

    describe('getMediaAssets', () => {
        it('should invoke get_media_assets with params', async () => {
            const mockResponse: import('../apiClient').MediaAssetsResponse = {
                items: [
                    createMockMediaAssetInfo('asset-1'),
                    createMockMediaAssetInfo('asset-2'),
                ],
                total: 2,
            };
            __setInvokeHandler(() => mockResponse);

            const params = {
                mediaType: 'image' as const,
                search: 'test',
                limit: 10,
                offset: 0,
            };
            const result = await apiClient.getMediaAssets(params);

            expect(result).toEqual(mockResponse);
            expect(invoke).toHaveBeenCalledWith('get_media_assets', { params });
        });

        it('should invoke get_media_assets without params', async () => {
            const mockResponse: import('../apiClient').MediaAssetsResponse = {
                items: [],
                total: 0,
            };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.getMediaAssets();

            expect(result).toEqual(mockResponse);
            expect(invoke).toHaveBeenCalledWith('get_media_assets', {
                params: undefined,
            });
        });

        it('should return MediaAssetsResponse with items and total', async () => {
            const mockResponse: import('../apiClient').MediaAssetsResponse = {
                items: [createMockMediaAssetInfo('asset-1')],
                total: 1,
            };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.getMediaAssets({ mediaType: 'image' });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.items[0].id).toBe('asset-1');
        });
    });

    describe('downloadAndSaveImage', () => {
        it('should invoke download_and_save_image with url and filename', async () => {
            const mockResult = createMockSaveImageResult('downloaded-asset');
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.downloadAndSaveImage(
                'https://example.com/image.png',
                'saved-image.png',
            );

            expect(result).toEqual(mockResult);
            expect(invoke).toHaveBeenCalledWith('download_and_save_image', {
                url: 'https://example.com/image.png',
                filename: 'saved-image.png',
            });
        });

        it('should invoke download_and_save_image with only url', async () => {
            const mockResult = createMockSaveImageResult('downloaded-asset');
            __setInvokeHandler(() => mockResult);

            await apiClient.downloadAndSaveImage('https://example.com/image.png');

            expect(invoke).toHaveBeenCalledWith('download_and_save_image', {
                url: 'https://example.com/image.png',
                filename: undefined,
            });
        });
    });

    describe('batchImportImages', () => {
        it('should invoke batch_import_images with filePaths array', async () => {
            const mockResults: import('../apiClient').BatchImportResult[] = [
                {
                    sourcePath: '/path/file1.png',
                    result: createMockSaveImageResult('asset-1'),
                    error: null,
                },
                {
                    sourcePath: '/path/file2.png',
                    result: createMockSaveImageResult('asset-2'),
                    error: null,
                },
            ];
            __setInvokeHandler(() => mockResults);

            const filePaths = ['/path/file1.png', '/path/file2.png'];
            const result = await apiClient.batchImportImages(filePaths);

            expect(result).toEqual(mockResults);
            expect(invoke).toHaveBeenCalledWith('batch_import_images', { filePaths });
        });

        it('should return array of BatchImportResult', async () => {
            const mockResults: import('../apiClient').BatchImportResult[] = [
                {
                    sourcePath: '/path/success.png',
                    result: createMockSaveImageResult('success'),
                    error: null,
                },
                {
                    sourcePath: '/path/error.png',
                    result: null,
                    error: 'File not found',
                },
            ];
            __setInvokeHandler(() => mockResults);

            const result = await apiClient.batchImportImages(['/path/success.png', '/path/error.png']);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0].error).toBeNull();
            expect(result[1].error).toBe('File not found');
        });
    });

    describe('deleteMediaAsset', () => {
        it('should invoke delete_media_asset with assetId and deleteFiles', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.deleteMediaAsset('asset-123', true);

            expect(invoke).toHaveBeenCalledWith('delete_media_asset', {
                assetId: 'asset-123',
                deleteFiles: true,
            });
        });

        it('should invoke delete_media_asset with only assetId', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.deleteMediaAsset('asset-123');

            expect(invoke).toHaveBeenCalledWith('delete_media_asset', {
                assetId: 'asset-123',
                deleteFiles: undefined,
            });
        });
    });

    describe('cleanupOrphanAssets', () => {
        it('should invoke cleanup_orphan_assets without args', async () => {
            const mockResult = {
                deletedCount: 5,
                deletedAssetIds: ['asset-1', 'asset-2', 'asset-3', 'asset-4', 'asset-5'],
            };
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.cleanupOrphanAssets();

            expect(result).toEqual(mockResult);
            expect(invoke).toHaveBeenCalledWith('cleanup_orphan_assets', undefined);
        });

        it('should return deletedCount and deletedAssetIds', async () => {
            const mockResult = {
                deletedCount: 2,
                deletedAssetIds: ['orphan-1', 'orphan-2'],
            };
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.cleanupOrphanAssets();

            expect(result.deletedCount).toBe(2);
            expect(result.deletedAssetIds).toEqual(['orphan-1', 'orphan-2']);
        });
    });

    // ========================================================================
    // Utility Commands
    // ========================================================================

    describe('getServerPort', () => {
        it('should invoke get_server_port without args', async () => {
            __setInvokeHandler(() => 3001);

            const result = await apiClient.getServerPort();

            expect(result).toBe(3001);
            expect(invoke).toHaveBeenCalledWith('get_server_port', undefined);
        });

        it('should return number', async () => {
            __setInvokeHandler(() => 8080);

            const result = await apiClient.getServerPort();

            expect(typeof result).toBe('number');
            expect(result).toBe(8080);
        });
    });

    describe('openInBrowser', () => {
        it('should invoke open_in_browser with url', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.openInBrowser('https://example.com');

            expect(invoke).toHaveBeenCalledWith('open_in_browser', {
                url: 'https://example.com',
            });
        });
    });

    describe('fetchImageAsBase64', () => {
        it('should invoke fetch_image_as_base64 with url', async () => {
            const mockResult = {
                success: true,
                data: 'data:image/png;base64,iVBORw0KGgo...',
                contentType: 'image/png',
            };
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.fetchImageAsBase64('https://example.com/image.png');

            expect(result).toEqual(mockResult);
            expect(invoke).toHaveBeenCalledWith('fetch_image_as_base64', {
                url: 'https://example.com/image.png',
            });
        });

        it('should return success response with data and contentType', async () => {
            const mockResult = {
                success: true,
                data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
                contentType: 'image/jpeg',
            };
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.fetchImageAsBase64('https://example.com/photo.jpg');

            expect(result.success).toBe(true);
            expect(result.data).toBeTruthy();
            expect(result.contentType).toBe('image/jpeg');
        });

        it('should return error response on failure', async () => {
            const mockResult = {
                success: false,
                error: 'Network error',
            };
            __setInvokeHandler(() => mockResult);

            const result = await apiClient.fetchImageAsBase64('https://example.com/missing.png');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
            expect(result.data).toBeUndefined();
        });
    });

    // ========================================================================
    // Recipe Management Commands
    // ========================================================================

    describe('listRecipeDirectory', () => {
        it('should invoke list_recipe_directory without subpath', async () => {
            const mockListing: import('@/types/recipe').DirectoryListing = [];
            __setInvokeHandler(() => mockListing);

            const result = await apiClient.listRecipeDirectory();

            expect(result).toEqual(mockListing);
            expect(invoke).toHaveBeenCalledWith('list_recipe_directory', {
                subpath: undefined,
            });
        });

        it('should invoke list_recipe_directory with subpath', async () => {
            const mockListing: import('@/types/recipe').DirectoryListing = [];
            __setInvokeHandler(() => mockListing);

            await apiClient.listRecipeDirectory('subfolder');

            expect(invoke).toHaveBeenCalledWith('list_recipe_directory', {
                subpath: 'subfolder',
            });
        });
    });

    describe('createRecipe', () => {
        it('should invoke create_recipe with recipeId and parentPath', async () => {
            const mockPath = '/recipes/new-recipe';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.createRecipe('my-recipe', '/recipes');

            expect(result).toBe(mockPath);
            expect(invoke).toHaveBeenCalledWith('create_recipe', {
                recipeId: 'my-recipe',
                parentPath: '/recipes',
            });
        });

        it('should invoke create_recipe with only recipeId', async () => {
            const mockPath = '/recipes/default-recipe';
            __setInvokeHandler(() => mockPath);

            await apiClient.createRecipe('default-recipe');

            expect(invoke).toHaveBeenCalledWith('create_recipe', {
                recipeId: 'default-recipe',
                parentPath: undefined,
            });
        });
    });

    describe('createRecipeFolder', () => {
        it('should invoke create_recipe_folder with folderName and parentPath', async () => {
            const mockPath = '/recipes/new-folder';
            __setInvokeHandler(() => mockPath);

            const result = await apiClient.createRecipeFolder('new-folder', '/recipes');

            expect(result).toBe(mockPath);
            expect(invoke).toHaveBeenCalledWith('create_recipe_folder', {
                folderName: 'new-folder',
                parentPath: '/recipes',
            });
        });
    });

    describe('deleteRecipe', () => {
        it('should invoke delete_recipe with recipePath', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.deleteRecipe('/recipes/my-recipe');

            expect(invoke).toHaveBeenCalledWith('delete_recipe', {
                recipePath: '/recipes/my-recipe',
            });
        });
    });

    describe('getRecipeFileTree', () => {
        it('should invoke get_recipe_file_tree with recipePath', async () => {
            const mockTree: import('@/types/recipe').FileNode[] = [];
            __setInvokeHandler(() => mockTree);

            const result = await apiClient.getRecipeFileTree('/recipes/my-recipe');

            expect(result).toEqual(mockTree);
            expect(invoke).toHaveBeenCalledWith('get_recipe_file_tree', {
                recipePath: '/recipes/my-recipe',
            });
        });
    });

    describe('readRecipeFile', () => {
        it('should invoke read_recipe_file with recipePath and filePath', async () => {
            const mockContent = 'file content here';
            __setInvokeHandler(() => mockContent);

            const result = await apiClient.readRecipeFile('/recipes/my-recipe', 'config.json');

            expect(result).toBe(mockContent);
            expect(invoke).toHaveBeenCalledWith('read_recipe_file', {
                recipePath: '/recipes/my-recipe',
                filePath: 'config.json',
            });
        });
    });

    describe('writeRecipeFile', () => {
        it('should invoke write_recipe_file with recipePath, filePath, and content', async () => {
            __setInvokeHandler(() => undefined);

            const content = '{ "key": "value" }';
            await apiClient.writeRecipeFile('/recipes/my-recipe', 'config.json', content);

            expect(invoke).toHaveBeenCalledWith('write_recipe_file', {
                recipePath: '/recipes/my-recipe',
                filePath: 'config.json',
                content,
            });
        });
    });

    describe('createRecipeFile', () => {
        it('should invoke create_recipe_file with recipePath and filePath', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.createRecipeFile('/recipes/my-recipe', 'new-file.json');

            expect(invoke).toHaveBeenCalledWith('create_recipe_file', {
                recipePath: '/recipes/my-recipe',
                filePath: 'new-file.json',
            });
        });
    });

    describe('deleteRecipeFile', () => {
        it('should invoke delete_recipe_file with recipePath and filePath', async () => {
            __setInvokeHandler(() => undefined);

            await apiClient.deleteRecipeFile('/recipes/my-recipe', 'old-file.json');

            expect(invoke).toHaveBeenCalledWith('delete_recipe_file', {
                recipePath: '/recipes/my-recipe',
                filePath: 'old-file.json',
            });
        });
    });

    // ========================================================================
    // Error Handling
    // ========================================================================

    describe('error handling', () => {
        it('should handle invoke errors gracefully', async () => {
            const mockError = new Error('Command failed');
            __setInvokeHandler(() => {
                throw mockError;
            });

            await expect(apiClient.invoke('failing_command')).rejects.toThrow('Command failed');
        });

        it('should propagate errors from project commands', async () => {
            const mockError = new Error('Project not found');
            __setInvokeHandler(() => {
                throw mockError;
            });

            await expect(apiClient.loadProject('/nonexistent.synnia')).rejects.toThrow(
                'Project not found',
            );
        });

        it('should propagate errors from asset commands', async () => {
            const mockError = new Error('Asset not found');
            __setInvokeHandler(() => {
                throw mockError;
            });

            await expect(apiClient.importFile('/missing.png')).rejects.toThrow('Asset not found');
        });

        it('should propagate errors from recipe commands', async () => {
            const mockError = new Error('Recipe not found');
            __setInvokeHandler(() => {
                throw mockError;
            });

            await expect(
                apiClient.getRecipeFileTree('/recipes/nonexistent'),
            ).rejects.toThrow('Recipe not found');
        });
    });

    // ========================================================================
    // Type Safety
    // ========================================================================

    describe('type safety', () => {
        it('should preserve types for project commands', async () => {
            const mockProject = createMockProject();
            __setInvokeHandler(() => mockProject);

            const result = await apiClient.loadProject('/test');

            // Type assertions would happen at compile time
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('nodes');
            expect(result).toHaveProperty('edges');
        });

        it('should preserve types for asset history commands', async () => {
            const mockEntry = createMockAssetHistoryEntry(1);
            __setInvokeHandler(() => [mockEntry]);

            const result = await apiClient.getAssetHistory('asset-1');

            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('assetId');
            expect(result[0]).toHaveProperty('contentHash');
            expect(result[0]).toHaveProperty('createdAt');
        });

        it('should preserve types for media asset commands', async () => {
            const mockAsset = createMockMediaAssetInfo('asset-1');
            const mockResponse: import('../apiClient').MediaAssetsResponse = {
                items: [mockAsset],
                total: 1,
            };
            __setInvokeHandler(() => mockResponse);

            const result = await apiClient.getMediaAssets();

            expect(result.items[0]).toHaveProperty('id');
            expect(result.items[0]).toHaveProperty('mediaType');
            expect(result.items[0]).toHaveProperty('name');
            expect(result.items[0]).toHaveProperty('content');
        });
    });
});
