/**
 * update_nodes Tool
 * 
 * Batch update data of one or more nodes.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { Pencil, Check, AlertCircle } from "lucide-react";

// =============================================================================
// Tool Definition
// =============================================================================

interface NodeUpdate {
    id: string;
    data: Record<string, unknown>;
}

interface UpdateResult {
    id: string;
    success: boolean;
    error?: string;
}

interface UpdateNodesResult {
    updated: number;
    failed: number;
    results: UpdateResult[];
}

export const UpdateNodesTool = makeAssistantTool({
    toolName: "update_nodes",
    description: "Update data of one or more nodes. Only the specified fields will be changed. Use this to modify node properties like title, state, or custom data.",
    parameters: z.object({
        updates: z.array(z.object({
            id: z.string().describe("Node ID to update"),
            data: z.string().describe("JSON string of partial data to merge into node.data, e.g., '{\"title\": \"New Title\"}'"),
        })),
    }),
    execute: async ({ updates }): Promise<UpdateNodesResult> => {
        const results = updates.map(({ id, data }) => {
            const node = graphEngine.state.nodes.find(n => n.id === id);
            if (!node) {
                return { id, success: false, error: "Node not found" };
            }

            try {
                // Parse JSON string to object
                const parsedData = JSON.parse(data);
                graphEngine.updateNode(id, {
                    data: { ...node.data, ...parsedData }
                });
                return { id, success: true };
            } catch (error) {
                return {
                    id,
                    success: false,
                    error: error instanceof Error ? error.message : "Update failed"
                };
            }
        });

        return {
            updated: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        };
    },
});

// =============================================================================
// Tool UI
// =============================================================================

export const UpdateNodesToolUI = makeAssistantToolUI({
    toolName: "update_nodes",
    render: ({ args, result, status }) => {
        const typedArgs = args as { updates?: NodeUpdate[] };
        const typedResult = result as UpdateNodesResult | undefined;

        if (status.type === "running") {
            return (
                <div className="flex items-center gap-2 p-3 border rounded-lg my-2 bg-muted/50">
                    <Pencil className="size-4 animate-pulse" />
                    <span>Updating {typedArgs.updates?.length || 0} node(s)...</span>
                </div>
            );
        }

        if (!typedResult) return null;

        const hasFailures = typedResult.failed > 0;

        return (
            <div className={`flex items-center gap-2 p-3 border rounded-lg my-2 ${hasFailures ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-green-50 dark:bg-green-950/30"
                }`}>
                {hasFailures ? (
                    <AlertCircle className="size-4 text-yellow-500" />
                ) : (
                    <Check className="size-4 text-green-500" />
                )}
                <span>
                    Updated {typedResult.updated} node(s)
                    {hasFailures && <span className="text-yellow-600"> ({typedResult.failed} failed)</span>}
                </span>
            </div>
        );
    },
});
