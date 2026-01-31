/**
 * create_node_smart Tool
 * 
 * Creates a new node on the canvas using the Smart API.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { Plus, Check, AlertCircle } from "lucide-react";

// =============================================================================
// Tool Definition
// =============================================================================

interface CreateNodeResult {
    success: boolean;
    nodeId?: string;
    type?: string;
    title?: string;
    error?: string;
}

export const CreateNodeSmartTool = makeAssistantTool({
    toolName: "create_node_smart",
    description: "CREATE or ADD a NEW node on the canvas. Use ONLY when user wants to create/add/new node. Supported types: 'text', 'image', 'video', 'file', 'record', 'form', 'selector', recipe types 'recipe:xxx'. DO NOT use this for delete/remove operations - use delete_nodes instead.",
    parameters: z.object({
        nodeType: z.string().describe("Node type, e.g., 'text', 'image', 'record', 'recipe:xxx'"),
        value: z.string().optional().describe("Initial value as JSON string, e.g., '\"hello world\"' for text or '{\"key\": \"value\"}' for object"),
        position: z.object({
            x: z.number(),
            y: z.number(),
        }).optional().describe("Position on canvas. If not provided, auto-positioned."),
    }),
    execute: async ({ nodeType, value, position }): Promise<CreateNodeResult> => {
        try {
            // Parse JSON string value if provided
            const parsedValue = value ? JSON.parse(value) : {};
            const nodeId = graphEngine.mutator.createSmart({
                node: nodeType,
                value: parsedValue,
                position: position ?? 'auto',
            });

            const createdNode = graphEngine.state.nodes.find(n => n.id === nodeId);

            return {
                success: true,
                nodeId,
                type: createdNode?.type,
                title: createdNode?.data?.title || createdNode?.data?.label || "New Node",
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create node",
            };
        }
    },
});

// =============================================================================
// Tool UI
// =============================================================================

export const CreateNodeSmartToolUI = makeAssistantToolUI({
    toolName: "create_node_smart",
    render: ({ args, result, status }) => {
        const typedArgs = args as { nodeType?: string };
        const typedResult = result as CreateNodeResult | undefined;

        // Tool call indicator - always show
        const ToolCallIndicator = () => (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Plus className={`size-3 ${status.type === "running" ? "animate-spin" : ""}`} />
                <span>
                    {status.type === "running" ? "正在调用" : "调用了"} create_node_smart 工具
                </span>
            </div>
        );

        if (status.type === "running") {
            return <ToolCallIndicator />;
        }

        if (typedResult?.success) {
            return (
                <>
                    <ToolCallIndicator />
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <Check className="size-4 text-green-500" />
                        <span>Created: <strong>{typedResult.title}</strong></span>
                        <span className="text-xs text-muted-foreground">
                            ({typedResult.nodeId?.slice(0, 8)})
                        </span>
                    </div>
                </>
            );
        }

        if (typedResult?.error) {
            return (
                <>
                    <ToolCallIndicator />
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-destructive/10 text-destructive">
                        <AlertCircle className="size-4" />
                        <span>Failed: {typedResult.error}</span>
                    </div>
                </>
            );
        }

        return null;
    },
});
