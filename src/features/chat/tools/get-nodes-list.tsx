/**
 * get_nodes_list Tool
 * 
 * Returns a list of nodes on the canvas with optional filtering.
 * Supports filtering by type, content state, title matching, and more.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { List } from "lucide-react";
import type { Asset } from "@/types/assets";

// =============================================================================
// Tool Definition
// =============================================================================

interface NodeInfo {
    id: string;
    type: string;
    title: string;
    state: string;
    position: { x: number; y: number };
    assetId?: string;
    // Full asset data if node has linked asset
    asset?: Asset;
    // Additional data for LLM analysis
    hasContent: boolean;
    contentPreview?: string;
}

export const GetNodesListTool = makeAssistantTool({
    toolName: "get_nodes_list",
    description: `QUERY nodes on the canvas with optional filters. Returns node id, type, title, state, position, and content info.
Use filters to narrow down results before analysis:
- nodeTypes: filter by type (form, image, selector, recipe, text, table, gallery, queue)
- isEmpty: true = nodes with no content, false = nodes with content
- titleContains: partial match on node title
- hasAsset: true = nodes linked to assets
- limit: max results to return

Examples:
- Query all form nodes: { nodeTypes: ["form"] }
- Query empty forms: { nodeTypes: ["form"], isEmpty: true }
- Query images with assets: { nodeTypes: ["image"], hasAsset: true }`,
    parameters: z.object({
        nodeTypes: z.array(z.string()).optional().describe("Filter by node types: form, image, selector, recipe, text, table, gallery, queue"),
        isEmpty: z.boolean().optional().describe("Filter by content: true = empty nodes, false = nodes with content"),
        titleContains: z.string().optional().describe("Filter nodes whose title contains this text (case-insensitive)"),
        hasAsset: z.boolean().optional().describe("Filter by asset link: true = has assetId, false = no assetId"),
        limit: z.number().optional().describe("Maximum number of results to return"),
    }),
    execute: async (params): Promise<NodeInfo[]> => {
        const { nodeTypes, isEmpty, titleContains, hasAsset, limit } = params;
        const nodes = graphEngine.state.nodes;

        console.log('[get_nodes_list] Filter params:', params);
        console.log('[get_nodes_list] Total nodes:', nodes?.length ?? 0);

        if (!nodes || nodes.length === 0) {
            console.warn('[get_nodes_list] No nodes found in graphEngine.state');
            return [];
        }

        // Apply filters
        let filtered = nodes;

        // Filter by node types
        if (nodeTypes && nodeTypes.length > 0) {
            const types = nodeTypes.map(t => t.toLowerCase());
            filtered = filtered.filter(node => types.includes(node.type.toLowerCase()));
        }

        // Filter by asset
        if (hasAsset !== undefined) {
            filtered = filtered.filter(node =>
                hasAsset ? !!node.data?.assetId : !node.data?.assetId
            );
        }

        // Filter by title contains
        if (titleContains) {
            const search = titleContains.toLowerCase();
            filtered = filtered.filter(node => {
                const title = (node.data?.title || node.data?.label || "").toLowerCase();
                return title.includes(search);
            });
        }

        // Map to NodeInfo with content detection and asset data
        let result = filtered.map(node => {
            // Get linked asset data first (needed for content detection)
            let asset: Asset | undefined;
            if (node.data?.assetId) {
                asset = graphEngine.assets.get(node.data.assetId);
            }

            // Detect if node has content based on asset value
            const hasContent = detectNodeHasContent(node, asset);
            const contentPreview = getContentPreview(node, asset);

            return {
                id: node.id,
                type: node.type,
                title: node.data?.title || node.data?.label || "Untitled",
                state: node.data?.state || "idle",
                position: node.position,
                assetId: node.data?.assetId,
                asset,
                hasContent,
                contentPreview,
            };
        });

        // Filter by isEmpty
        if (isEmpty !== undefined) {
            result = result.filter(node => isEmpty ? !node.hasContent : node.hasContent);
        }

        // Apply limit
        if (limit && limit > 0) {
            result = result.slice(0, limit);
        }

        console.log('[get_nodes_list] Returning', result.length, 'nodes after filtering');
        return result;
    },
});

/**
 * Detect if a node has meaningful content based on its asset value
 * Empty means: no asset, or asset.value is null/undefined/{}/[]
 */
function detectNodeHasContent(node: any, asset?: Asset): boolean {
    // No asset = no content
    if (!asset) return false;

    const value = asset.value;

    // Check for empty values
    if (value === null || value === undefined) {
        return false;
    }

    // Check for empty object {}
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        return false;
    }

    // Check for empty array []
    if (Array.isArray(value) && value.length === 0) {
        return false;
    }

    return true;
}

/**
 * Get a brief preview of node content for LLM context
 */
function getContentPreview(_node: any, asset?: Asset): string | undefined {
    if (!asset) return undefined;

    const value = asset.value;
    if (value === null || value === undefined) return undefined;

    try {
        if (asset.valueType === 'record') {
            // For record assets, show field count and keys
            const keys = Object.keys(value as Record<string, any>);
            if (keys.length === 0) return undefined;
            return `${keys.length} fields: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
        } else if (asset.valueType === 'array') {
            // For array assets, show item count
            const arr = value as any[];
            if (arr.length === 0) return undefined;
            return `${arr.length} items`;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

// =============================================================================
// Tool UI
// =============================================================================

export const GetNodesListToolUI = makeAssistantToolUI({
    toolName: "get_nodes_list",
    render: ({ result, status }) => {
        // Tool call indicator - always show
        const ToolCallIndicator = () => (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <List className={`size-3 ${status.type === "running" ? "animate-spin" : ""}`} />
                <span>
                    {status.type === "running" ? "正在调用" : "调用了"} get_nodes_list 工具
                </span>
            </div>
        );

        if (status.type === "running") {
            return <ToolCallIndicator />;
        }

        const nodes = result as NodeInfo[] | undefined;

        if (!nodes || nodes.length === 0) {
            return (
                <>
                    <ToolCallIndicator />
                    <div className="p-3 text-muted-foreground text-sm border rounded-lg">
                        No nodes on canvas
                    </div>
                </>
            );
        }

        return (
            <>
                <ToolCallIndicator />
                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-sm font-medium border-b flex items-center gap-2">
                        <List className="size-4" />
                        <span>Nodes ({nodes.length})</span>
                    </div>
                    <div className="divide-y max-h-64 overflow-y-auto">
                        {nodes.map(node => (
                            <div key={node.id} className="px-3 py-2 text-sm flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                    {node.id.slice(0, 8)}
                                </span>
                                <span className="font-medium flex-1 truncate">{node.title}</span>
                                <span className="text-muted-foreground text-xs">({node.type})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    },
});
