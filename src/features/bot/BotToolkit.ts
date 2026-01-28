/**
 * Bot Toolkit - AI Assistant Tool Definitions
 *
 * Defines the 6 core tools that the AI assistant can use to interact
 * with the Synnia canvas.
 *
 * Phase 5 Scope:
 * - get_nodes_list: Get all canvas nodes
 * - get_asset_details: Get asset information
 * - create_node_smart: Create nodes using smart inference
 * - update_nodes: Update node data
 * - update_assets: Update asset values
 * - delete_nodes: Delete nodes with confirmation
 *
 * @see PRD-bot.md Phase 5
 * @see PRD-bot-examples.md
 */

import { graphEngine } from '@/core/engine/GraphEngine';
import { useBotStore } from '@/store/botStore';
import { z } from 'zod';

// ============================================================================
// Helper: Confirmation Dialog
// ============================================================================

/**
 * Show a confirmation dialog and return a Promise that resolves
 * to true if confirmed, false if cancelled.
 *
 * @param message - The message to display in the confirmation dialog
 * @returns Promise<boolean> - true if user confirmed, false if cancelled
 */
function showConfirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        useBotStore.getState().showConfirmDialog(
            message,
            () => {
                useBotStore.getState().closeConfirmDialog();
                resolve(true);
            },
            () => {
                useBotStore.getState().closeConfirmDialog();
                resolve(false);
            }
        );
    });
}

// ============================================================================
// Tool 1: Get Nodes List
// ============================================================================

/**
 * Get a list of all nodes on the canvas with their key properties.
 */
const getNodesList = {
    name: 'get_nodes_list',
    description: 'Get a list of all nodes on the canvas with their IDs, types, titles, states, positions, and asset IDs',
    parameters: z.object({}),
    execute: async () => {
        const { nodes } = graphEngine.state;

        return nodes.map(n => ({
            id: n.id,
            type: n.type,
            title: n.data.title,
            state: n.data.state,
            position: n.position,
            assetId: n.data.assetId,
            parentId: n.parentId,
            selected: n.selected,
        }));
    },
};

// ============================================================================
// Tool 2: Get Asset Details
// ============================================================================

/**
 * Get detailed information about one or more assets by their IDs.
 */
const getAssetDetails = {
    name: 'get_asset_details',
    description: 'Get detailed information about one or more assets by their IDs, including their values, metadata, and configuration',
    parameters: z.object({
        assetIds: z.array(z.string()).describe('Array of asset IDs to retrieve details for'),
    }),
    execute: async ({ assetIds }: { assetIds: string[] }) => {
        const results = [];

        for (const id of assetIds) {
            const asset = graphEngine.assets.get(id);
            if (!asset) {
                results.push({
                    id,
                    error: 'Asset not found',
                });
                continue;
            }

            // Return asset details with full information
            results.push({
                id: asset.id,
                valueType: asset.valueType,
                value: asset.value,
                config: asset.config,
                sys: asset.sys,
            });
        }

        return results;
    },
};

// ============================================================================
// Tool 3: Create Node Smart
// ============================================================================

/**
 * Create a new node on the canvas using smart type inference.
 * Uses the GraphMutator's createSmart method.
 */
const createNodeSmart = {
    name: 'create_node_smart',
    description: 'Create a new node on the canvas using smart type inference. Supports node types: text, image, form, recipe, selector, gallery, table, rack',
    parameters: z.object({
        nodeType: z.enum(['text', 'image', 'form', 'recipe', 'selector', 'gallery', 'table', 'rack'])
            .describe('Type of node to create'),
        value: z.any().describe('Content/value for the node (will be used to create the asset)'),
        position: z.object({
            x: z.number(),
            y: z.number(),
        }).optional().describe('Position on canvas (defaults to (100, 100))'),
        name: z.string().optional().describe('Optional custom name for the node and asset'),
    }),
    execute: async ({
        nodeType,
        value,
        position,
        name,
    }: {
        nodeType: string;
        value: unknown;
        position?: { x: number; y: number };
        name?: string;
    }) => {
        try {
            const nodeId = graphEngine.mutator.createSmart({
                node: nodeType,
                value,
                position: position || { x: 100, y: 100 },
                name,
            });

            return {
                success: true,
                nodeId,
                nodeType,
                message: `Created ${nodeType} node with ID: ${nodeId}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                message: `Failed to create ${nodeType} node`,
            };
        }
    },
};

// ============================================================================
// Tool 4: Update Nodes
// ============================================================================

/**
 * Update one or more nodes with new data.
 * Uses GraphEngine.updateNodes for batch updates.
 */
const updateNodes = {
    name: 'update_nodes',
    description: 'Update one or more nodes with new data. Supports updating title, state, and other node properties',
    parameters: z.object({
        updates: z.array(
            z.object({
                id: z.string().describe('Node ID to update'),
                data: z.record(z.string(), z.any()).describe('Partial node data to merge with existing data'),
            })
        ).describe('Array of node updates to apply'),
    }),
    execute: async ({ updates }: { updates: Array<{ id: string; data: Record<string, unknown> }> }) => {
        const results = [];

        for (const { id, data } of updates) {
            try {
                graphEngine.updateNode(id, { data });
                results.push({ id, success: true });
            } catch (error) {
                results.push({
                    id,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        const successCount = results.filter(r => r.success).length;

        return {
            totalUpdated: successCount,
            totalRequested: updates.length,
            results,
        };
    },
};

// ============================================================================
// Tool 5: Update Assets
// ============================================================================

/**
 * Update one or more assets with new values.
 * Uses AssetSystem.update to modify asset values.
 */
const updateAssets = {
    name: 'update_assets',
    description: 'Update one or more assets with new values. The value will replace the existing asset value',
    parameters: z.object({
        updates: z.array(
            z.object({
                id: z.string().describe('Asset ID to update'),
                value: z.any().describe('New value for the asset (will replace existing value)'),
            })
        ).describe('Array of asset updates to apply'),
    }),
    execute: async ({ updates }: { updates: Array<{ id: string; value: unknown }> }) => {
        const results = [];

        for (const { id, value } of updates) {
            try {
                await graphEngine.assets.update(id, value);
                results.push({ id, success: true });
            } catch (error) {
                results.push({
                    id,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        const successCount = results.filter(r => r.success).length;

        return {
            totalUpdated: successCount,
            totalRequested: updates.length,
            results,
        };
    },
};

// ============================================================================
// Tool 6: Delete Nodes (Requires Confirmation)
// ============================================================================

/**
 * Delete one or more nodes from the canvas.
 * This is a dangerous operation and requires user confirmation.
 */
const deleteNodes = {
    name: 'delete_nodes',
    description: 'Delete one or more nodes from the canvas. This is a DANGEROUS operation that will permanently remove nodes and requires user confirmation',
    parameters: z.object({
        nodeIds: z.array(z.string()).describe('Array of node IDs to delete'),
    }),
    execute: async ({ nodeIds }: { nodeIds: string[] }) => {
        if (nodeIds.length === 0) {
            return {
                success: false,
                message: 'No nodes to delete',
            };
        }

        // Show confirmation dialog
        const confirmed = await showConfirmDialog(
            `Are you sure you want to delete ${nodeIds.length} node(s)?\n\n` +
            `Node IDs: ${nodeIds.join(', ')}\n\n` +
            `This action cannot be undone.`
        );

        if (!confirmed) {
            return {
                success: false,
                cancelled: true,
                message: 'Deletion cancelled by user',
            };
        }

        // Proceed with deletion
        try {
            graphEngine.deleteNodes(nodeIds);

            return {
                success: true,
                deletedCount: nodeIds.length,
                deletedIds: nodeIds,
                message: `Successfully deleted ${nodeIds.length} node(s)`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                message: `Failed to delete nodes`,
            };
        }
    },
};

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * Bot Toolkit - Complete tool registry for the AI assistant.
 *
 * Export as BOT_TOOLS array for easy iteration and as a record for lookup.
 */
export const BOT_TOOLS = [
    getNodesList,
    getAssetDetails,
    createNodeSmart,
    updateNodes,
    updateAssets,
    deleteNodes,
] as const;

/**
 * Tool lookup map by name.
 * Useful for runtime tool resolution.
 */
export const BOT_TOOL_MAP: Record<string, (typeof BOT_TOOLS)[number]> = {
    get_nodes_list: getNodesList,
    get_asset_details: getAssetDetails,
    create_node_smart: createNodeSmart,
    update_nodes: updateNodes,
    update_assets: updateAssets,
    delete_nodes: deleteNodes,
};

/**
 * Get tool definition for use with Vercel AI SDK / assistant-ui.
 *
 * @param toolName - Name of the tool to get definition for
 * @returns Tool definition or undefined if not found
 */
export function getBotToolDefinition(toolName: string) {
    const tool = BOT_TOOL_MAP[toolName];
    if (!tool) return undefined;

    return {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
    };
}

/**
 * Get all tool definitions for use with Vercel AI SDK.
 */
export function getAllBotToolDefinitions() {
    return BOT_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
    }));
}

/**
 * Execute a bot tool by name with given parameters.
 *
 * @param toolName - Name of the tool to execute
 * @param params - Parameters to pass to the tool
 * @returns Result of tool execution
 */
export async function executeBotTool(toolName: string, params: unknown): Promise<unknown> {
    const tool = BOT_TOOL_MAP[toolName];
    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return tool.execute(params as never);
}

// ============================================================================
// Tool Execution Result Types
// ============================================================================

/**
 * Result from get_nodes_list tool
 */
export type GetNodesListResult = ReturnType<typeof getNodesList.execute>;

/**
 * Result from get_asset_details tool
 */
export type GetAssetDetailsResult = ReturnType<typeof getAssetDetails.execute>;

/**
 * Result from create_node_smart tool
 */
export type CreateNodeSmartResult = ReturnType<typeof createNodeSmart.execute>;

/**
 * Result from update_nodes tool
 */
export type UpdateNodesResult = ReturnType<typeof updateNodes.execute>;

/**
 * Result from update_assets tool
 */
export type UpdateAssetsResult = ReturnType<typeof updateAssets.execute>;

/**
 * Result from delete_nodes tool
 */
export type DeleteNodesResult = ReturnType<typeof deleteNodes.execute>;
