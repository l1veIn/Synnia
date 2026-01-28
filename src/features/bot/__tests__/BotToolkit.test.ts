/**
 * Bot Toolkit Tests
 *
 * Tests for the 6 core bot tools:
 * - get_nodes_list
 * - get_asset_details
 * - create_node_smart
 * - update_nodes
 * - update_assets
 * - delete_nodes
 *
 * @see src/features/bot/BotToolkit.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    BOT_TOOLS,
    BOT_TOOL_MAP,
    getBotToolDefinition,
    getAllBotToolDefinitions,
    executeBotTool,
} from '../BotToolkit';
import { graphEngine } from '@/core/engine/GraphEngine';
import { useBotStore } from '@/store/botStore';

// Mock GraphEngine
vi.mock('@/core/engine/GraphEngine', () => ({
    graphEngine: {
        state: {
            nodes: [],
        },
        updateNode: vi.fn(),
        deleteNodes: vi.fn(),
        mutator: {
            createSmart: vi.fn(),
        },
        assets: {
            get: vi.fn(),
            update: vi.fn(),
        },
    },
}));

// Mock botStore
vi.mock('@/store/botStore', () => ({
    useBotStore: {
        getState: vi.fn(),
    },
}));

describe('BotToolkit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tool Registry', () => {
        it('should have exactly 6 tools', () => {
            expect(BOT_TOOLS).toHaveLength(6);
        });

        it('should have all required tools', () => {
            const toolNames = BOT_TOOLS.map(t => t.name);
            expect(toolNames).toContain('get_nodes_list');
            expect(toolNames).toContain('get_asset_details');
            expect(toolNames).toContain('create_node_smart');
            expect(toolNames).toContain('update_nodes');
            expect(toolNames).toContain('update_assets');
            expect(toolNames).toContain('delete_nodes');
        });

        it('should have a tool map with all tools', () => {
            const mapKeys = Object.keys(BOT_TOOL_MAP);
            expect(mapKeys).toHaveLength(6);
            expect(mapKeys).toContain('get_nodes_list');
            expect(mapKeys).toContain('get_asset_details');
            expect(mapKeys).toContain('create_node_smart');
            expect(mapKeys).toContain('update_nodes');
            expect(mapKeys).toContain('update_assets');
            expect(mapKeys).toContain('delete_nodes');
        });

        it('should get tool definition by name', () => {
            const def = getBotToolDefinition('get_nodes_list');
            expect(def).toBeDefined();
            expect(def?.name).toBe('get_nodes_list');
            expect(def?.description).toBeDefined();
            expect(def?.parameters).toBeDefined();
        });

        it('should return undefined for unknown tool', () => {
            const def = getBotToolDefinition('unknown_tool');
            expect(def).toBeUndefined();
        });

        it('should get all tool definitions', () => {
            const defs = getAllBotToolDefinitions();
            expect(defs).toHaveLength(6);
            defs.forEach(def => {
                expect(def.name).toBeDefined();
                expect(def.description).toBeDefined();
                expect(def.parameters).toBeDefined();
            });
        });
    });

    describe('Tool: get_nodes_list', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.get_nodes_list;
            expect(tool.name).toBe('get_nodes_list');
            expect(tool.description).toContain('nodes');
            expect(tool.parameters).toBeDefined();
        });

        it('should return node list when executed', async () => {
            const mockNodes = [
                { id: 'node1', type: 'text', data: { title: 'Node 1', state: 'idle', assetId: 'asset1' }, position: { x: 100, y: 100 }, parentId: null, selected: false },
                { id: 'node2', type: 'image', data: { title: 'Node 2', state: 'idle', assetId: 'asset2' }, position: { x: 200, y: 200 }, parentId: null, selected: true },
            ];

            vi.mocked(graphEngine.state).nodes = mockNodes as any;

            const tool = BOT_TOOL_MAP.get_nodes_list;
            const result = await tool.execute({} as never) as Array<{
                id: string;
                type: string;
                title: string;
                state: string;
                position: { x: number; y: number };
                assetId: string;
            }>;

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('node1');
            expect(result[0].type).toBe('text');
            expect(result[0].title).toBe('Node 1');
            expect(result[1].id).toBe('node2');
            expect(result[1].type).toBe('image');
        });

        it('should return empty array when no nodes exist', async () => {
            vi.mocked(graphEngine.state).nodes = [];

            const tool = BOT_TOOL_MAP.get_nodes_list;
            const result = await tool.execute({} as never) as unknown[];

            expect(result).toEqual([]);
        });
    });

    describe('Tool: get_asset_details', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.get_asset_details;
            expect(tool.name).toBe('get_asset_details');
            expect(tool.description).toContain('asset');
        });

        it('should return asset details when asset exists', async () => {
            const mockAsset = {
                id: 'asset1',
                valueType: 'record',
                value: { name: 'Test', count: 42 },
                config: { schema: [] },
                sys: { name: 'Test Asset', createdAt: Date.now(), updatedAt: Date.now(), source: 'user', isLibraryAsset: null },
            };

            vi.mocked(graphEngine.assets.get).mockReturnValue(mockAsset as any);

            const tool = BOT_TOOL_MAP.get_asset_details;
            const result = await tool.execute({ assetIds: ['asset1'] } as never) as unknown[];

            expect(result).toHaveLength(1);
            expect(result[0] as { id: string }).toHaveProperty('id', 'asset1');
        });

        it('should return error for non-existent asset', async () => {
            vi.mocked(graphEngine.assets.get).mockReturnValue(undefined);

            const tool = BOT_TOOL_MAP.get_asset_details;
            const result = await tool.execute({ assetIds: ['nonexistent'] } as never) as Array<{ id: string; error?: string }>;

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('nonexistent');
            expect(result[0].error).toBe('Asset not found');
        });

        it('should handle multiple asset IDs', async () => {
            const mockAsset1 = { id: 'asset1', valueType: 'record', value: {}, config: {}, sys: {} };
            const mockAsset2 = { id: 'asset2', valueType: 'array', value: [], config: {}, sys: {} };

            vi.mocked(graphEngine.assets.get).mockImplementation((id) => {
                if (id === 'asset1') return mockAsset1 as any;
                if (id === 'asset2') return mockAsset2 as any;
                return undefined;
            });

            const tool = BOT_TOOL_MAP.get_asset_details;
            const result = await tool.execute({ assetIds: ['asset1', 'asset2', 'asset3'] } as never) as Array<{ id: string; error?: string }>;

            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('asset1');
            expect(result[1].id).toBe('asset2');
            expect(result[2].error).toBe('Asset not found');
        });
    });

    describe('Tool: create_node_smart', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.create_node_smart;
            expect(tool.name).toBe('create_node_smart');
            expect(tool.description).toContain('Create');
        });

        it('should create node successfully', async () => {
            const mockNodeId = 'new-node-id';
            vi.mocked(graphEngine.mutator.createSmart).mockReturnValue(mockNodeId);

            const tool = BOT_TOOL_MAP.create_node_smart;
            const result = await tool.execute({
                nodeType: 'text',
                value: { content: 'Hello' },
                position: { x: 150, y: 150 },
            } as never) as { success: boolean; nodeId: string; message: string };

            expect(result.success).toBe(true);
            expect(result.nodeId).toBe(mockNodeId);
            expect(result.message).toContain('Created text node');
            expect(graphEngine.mutator.createSmart).toHaveBeenCalledWith({
                node: 'text',
                value: { content: 'Hello' },
                position: { x: 150, y: 150 },
                name: undefined,
            });
        });

        it('should use default position when not provided', async () => {
            const mockNodeId = 'new-node-id';
            vi.mocked(graphEngine.mutator.createSmart).mockReturnValue(mockNodeId);

            const tool = BOT_TOOL_MAP.create_node_smart;
            await tool.execute({
                nodeType: 'text',
                value: { content: 'Hello' },
            } as never);

            expect(graphEngine.mutator.createSmart).toHaveBeenCalledWith(
                expect.objectContaining({
                    position: { x: 100, y: 100 },
                })
            );
        });

        it('should handle createSmart errors', async () => {
            vi.mocked(graphEngine.mutator.createSmart).mockImplementation(() => {
                throw new Error('Failed to create node');
            });

            const tool = BOT_TOOL_MAP.create_node_smart;
            const result = await tool.execute({
                nodeType: 'text',
                value: { content: 'Hello' },
            } as never) as { success: boolean; error?: string };

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create node');
        });
    });

    describe('Tool: update_nodes', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.update_nodes;
            expect(tool.name).toBe('update_nodes');
            expect(tool.description).toContain('Update');
        });

        it('should update nodes successfully', async () => {
            vi.mocked(graphEngine.updateNode).mockReturnValue(undefined);

            const tool = BOT_TOOL_MAP.update_nodes;
            const result = await tool.execute({
                updates: [
                    { id: 'node1', data: { title: 'Updated Title 1' } },
                    { id: 'node2', data: { title: 'Updated Title 2' } },
                ],
            } as never) as { totalUpdated: number; results: Array<{ id: string; success: boolean }> };

            expect(result.totalUpdated).toBe(2);
            expect(result.results).toHaveLength(2);
            expect(result.results[0]).toEqual({ id: 'node1', success: true });
            expect(result.results[1]).toEqual({ id: 'node2', success: true });
            expect(graphEngine.updateNode).toHaveBeenCalledTimes(2);
        });

        it('should handle update errors', async () => {
            vi.mocked(graphEngine.updateNode).mockImplementation((id) => {
                if (id === 'node2') {
                    throw new Error('Node not found');
                }
            });

            const tool = BOT_TOOL_MAP.update_nodes;
            const result = await tool.execute({
                updates: [
                    { id: 'node1', data: { title: 'Updated' } },
                    { id: 'node2', data: { title: 'Updated' } },
                ],
            } as never) as { totalUpdated: number; results: Array<{ id: string; success: boolean; error?: string }> };

            expect(result.totalUpdated).toBe(1);
            expect(result.results[1].success).toBe(false);
            expect(result.results[1].error).toBe('Node not found');
        });
    });

    describe('Tool: update_assets', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.update_assets;
            expect(tool.name).toBe('update_assets');
            expect(tool.description).toContain('asset');
        });

        it('should update assets successfully', async () => {
            vi.mocked(graphEngine.assets.update).mockResolvedValue(undefined);

            const tool = BOT_TOOL_MAP.update_assets;
            const result = await tool.execute({
                updates: [
                    { id: 'asset1', value: { name: 'Updated 1' } },
                    { id: 'asset2', value: { name: 'Updated 2' } },
                ],
            } as never) as { totalUpdated: number; results: unknown[] };

            expect(result.totalUpdated).toBe(2);
            expect(result.results).toHaveLength(2);
            expect(graphEngine.assets.update).toHaveBeenCalledTimes(2);
        });

        it('should handle update errors', async () => {
            vi.mocked(graphEngine.assets.update).mockImplementation((id) => {
                if (id === 'asset2') {
                    throw new Error('Asset not found');
                }
                return Promise.resolve(undefined);
            });

            const tool = BOT_TOOL_MAP.update_assets;
            const result = await tool.execute({
                updates: [
                    { id: 'asset1', value: { name: 'Updated' } },
                    { id: 'asset2', value: { name: 'Updated' } },
                ],
            } as never) as { totalUpdated: number; results: Array<{ id: string; success: boolean }> };

            expect(result.totalUpdated).toBe(1);
            expect(result.results[1].success).toBe(false);
        });
    });

    describe('Tool: delete_nodes', () => {
        it('should have correct structure', () => {
            const tool = BOT_TOOL_MAP.delete_nodes;
            expect(tool.name).toBe('delete_nodes');
            expect(tool.description).toContain('DANGEROUS');
        });

        it('should show confirmation dialog', async () => {
            const closeConfirmDialogMock = vi.fn();
            const showConfirmDialogMock = vi.fn();
            vi.mocked(useBotStore.getState).mockReturnValue({
                showConfirmDialog: showConfirmDialogMock,
                closeConfirmDialog: closeConfirmDialogMock,
            } as any);

            const tool = BOT_TOOL_MAP.delete_nodes;
            const promise = tool.execute({ nodeIds: ['node1', 'node2'] } as never);

            // showConfirmDialog should be called
            expect(showConfirmDialogMock).toHaveBeenCalled();

            // Simulate user confirmation
            const callback = showConfirmDialogMock.mock.calls[0][1];
            callback();

            const result = await promise as { success: boolean; cancelled?: boolean };
            expect(result.success).toBe(true);
            expect(result.cancelled).toBeUndefined();
        });

        it('should handle empty node list', async () => {
            const tool = BOT_TOOL_MAP.delete_nodes;
            const result = await tool.execute({ nodeIds: [] } as never) as { success: boolean; message: string };

            expect(result.success).toBe(false);
            expect(result.message).toBe('No nodes to delete');
        });

        it('should cancel when user rejects confirmation', async () => {
            const closeConfirmDialogMock = vi.fn();
            const showConfirmDialogMock = vi.fn();
            vi.mocked(useBotStore.getState).mockReturnValue({
                showConfirmDialog: showConfirmDialogMock,
                closeConfirmDialog: closeConfirmDialogMock,
            } as any);

            const tool = BOT_TOOL_MAP.delete_nodes;
            const promise = tool.execute({ nodeIds: ['node1'] } as never);

            // Simulate user cancellation
            const cancelCallback = showConfirmDialogMock.mock.calls[0][2];
            cancelCallback();

            const result = await promise as { success: boolean; cancelled: boolean; message: string };
            expect(result.success).toBe(false);
            expect(result.cancelled).toBe(true);
            expect(result.message).toBe('Deletion cancelled by user');
        });
    });

    describe('executeBotTool', () => {
        it('should execute tool by name', async () => {
            vi.mocked(graphEngine.state).nodes = [];

            const result = await executeBotTool('get_nodes_list', {});
            expect(Array.isArray(result)).toBe(true);
        });

        it('should throw error for unknown tool', async () => {
            await expect(executeBotTool('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
        });
    });
});
