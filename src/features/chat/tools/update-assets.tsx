/**
 * update_assets Tool
 * 
 * Batch update the value of one or more assets.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { FileEdit, Check, AlertCircle } from "lucide-react";

// =============================================================================
// Tool Definition
// =============================================================================

interface AssetUpdate {
    id: string;
    value: unknown;
}

interface UpdateResult {
    id: string;
    success: boolean;
    error?: string;
}

interface UpdateAssetsResult {
    updated: number;
    failed: number;
    results: UpdateResult[];
}

export const UpdateAssetsTool = makeAssistantTool({
    toolName: "update_assets",
    description: "Update the value of one or more assets. The entire value will be replaced with the new value.",
    parameters: z.object({
        updates: z.array(z.object({
            id: z.string().describe("Asset ID to update"),
            value: z.string().describe("New value for the asset as JSON string, e.g., '\"hello\"' for string or '{\"key\": \"value\"}' for object"),
        })),
    }),
    execute: async ({ updates }): Promise<UpdateAssetsResult> => {
        const results = updates.map(({ id, value }) => {
            const asset = graphEngine.assets.get(id);
            if (!asset) {
                return { id, success: false, error: "Asset not found" };
            }

            try {
                // Parse JSON string to actual value
                const parsedValue = JSON.parse(value);
                graphEngine.assets.update(id, parsedValue);
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

export const UpdateAssetsToolUI = makeAssistantToolUI({
    toolName: "update_assets",
    render: ({ args, result, status }) => {
        const typedArgs = args as { updates?: AssetUpdate[] };
        const typedResult = result as UpdateAssetsResult | undefined;

        if (status.type === "running") {
            return (
                <div className="flex items-center gap-2 p-3 border rounded-lg my-2 bg-muted/50">
                    <FileEdit className="size-4 animate-pulse" />
                    <span>Updating {typedArgs.updates?.length || 0} asset(s)...</span>
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
                    Updated {typedResult.updated} asset(s)
                    {hasFailures && <span className="text-yellow-600"> ({typedResult.failed} failed)</span>}
                </span>
            </div>
        );
    },
});
