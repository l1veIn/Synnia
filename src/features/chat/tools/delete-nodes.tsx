/**
 * delete_nodes Tool (Human-in-the-Loop)
 * 
 * Deletes one or more nodes from the canvas after user confirmation.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { Trash2, AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// =============================================================================
// Tool Definition
// =============================================================================

interface NodePreview {
    id: string;
    title: string;
    type: string;
}

interface DeleteNodesResult {
    pending?: boolean;
    nodes?: NodePreview[];
    confirmed?: boolean;
    deleted?: number;
    message?: string;
}

export const DeleteNodesTool = makeAssistantTool({
    toolName: "delete_nodes",
    description: "DELETE or REMOVE nodes. REQUIRED: Extract the node name from user message and pass it as 'query'. Example: if user says 'delete 命名大师', call with query='命名大师'. If user says 'remove the image node', call with query='image'.",
    parameters: z.object({
        query: z.string().describe("REQUIRED: The node name/title/type mentioned by user. Extract from user message."),
    }),
    execute: async ({ query }): Promise<DeleteNodesResult> => {
        const nodes = graphEngine.state.nodes;
        const searchTerm = (query || "").toLowerCase().trim();

        if (!searchTerm) {
            console.error('[delete_nodes] Empty query provided');
            return {
                pending: false,
                confirmed: false,
                deleted: 0,
            };
        }

        // Search: match by title or label only (not type/ID for precision)
        const matchedNodes = nodes.filter(n => {
            const title = (n.data?.title || "").toLowerCase();
            const label = (n.data?.label || "").toLowerCase();

            // Only match if title or label contains the search term
            return (title && title.includes(searchTerm)) ||
                (label && label.includes(searchTerm));
        });

        if (matchedNodes.length === 0) {
            console.log('[delete_nodes] No nodes matched query:', query);
            return {
                pending: false,
                confirmed: false,
                deleted: 0,
                message: `No nodes found matching "${query}"`,
            };
        }

        console.log('[delete_nodes] Found', matchedNodes.length, 'nodes matching:', query);

        return {
            pending: true,
            nodes: matchedNodes.map(n => ({
                id: n.id,
                title: n.data?.title || n.data?.label || "Untitled",
                type: n.type,
            })),
        };
    },
});

// =============================================================================
// Confirmation Component (with React state + localStorage persistence)
// =============================================================================

type ConfirmationState = 'pending' | 'confirmed' | 'cancelled';

// Simple localStorage persistence (no useAuiState to avoid store errors)
const STORAGE_KEY_PREFIX = 'synnia_tool_confirm_';

function getStoredConfirmation(toolCallId: string): { state: ConfirmationState; deletedCount?: number } | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_PREFIX + toolCallId);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

function storeConfirmation(toolCallId: string, state: ConfirmationState, deletedCount?: number) {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + toolCallId, JSON.stringify({ state, deletedCount }));
    } catch {
        // Ignore storage errors
    }
}

interface DeleteConfirmationProps {
    toolCallId: string;
    nodes: NodePreview[];
    idsToDelete: string[];
}

function DeleteConfirmation({ toolCallId, nodes, idsToDelete }: DeleteConfirmationProps) {
    // Initialize from localStorage
    const stored = getStoredConfirmation(toolCallId);
    const [state, setState] = useState<ConfirmationState>(stored?.state || 'pending');
    const [deletedCount, setDeletedCount] = useState<number>(stored?.deletedCount || 0);

    const handleConfirm = () => {
        graphEngine.deleteNodes(idsToDelete);
        setState('confirmed');
        setDeletedCount(idsToDelete.length);
        storeConfirmation(toolCallId, 'confirmed', idsToDelete.length);
    };

    const handleCancel = () => {
        setState('cancelled');
        storeConfirmation(toolCallId, 'cancelled');
    };

    if (state === 'confirmed') {
        return (
            <div className="flex items-center gap-2 p-3 border rounded-lg text-destructive">
                <Trash2 className="size-4" />
                <span>已删除 {deletedCount || idsToDelete.length} 个节点</span>
            </div>
        );
    }

    if (state === 'cancelled') {
        return (
            <div className="flex items-center gap-2 p-3 border rounded-lg text-muted-foreground">
                <X className="size-4" />
                <span>已取消删除</span>
            </div>
        );
    }

    return (
        <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive mb-3">
                <AlertTriangle className="size-5" />
                <span className="font-medium">确认删除?</span>
            </div>

            {nodes.length > 0 && (
                <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
                    {nodes.map((node) => (
                        <div key={node.id} className="flex items-center gap-2 text-sm">
                            <Trash2 className="size-3 text-muted-foreground" />
                            <span>{node.title}</span>
                            <span className="text-muted-foreground">({node.type})</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleConfirm}>
                    <Check className="size-4 mr-1" />
                    确认
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="size-4 mr-1" />
                    取消
                </Button>
            </div>
        </div>
    );
}



// =============================================================================
// Tool UI (Human-in-the-Loop)
// =============================================================================

export const DeleteNodesToolUI = makeAssistantToolUI({
    toolName: "delete_nodes",
    render: ({ args, result, status, addResult }) => {
        const typedResult = result as DeleteNodesResult | undefined;

        // Tool call indicator - always show
        const ToolCallIndicator = () => (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Trash2 className={`size-3 ${status.type === "running" ? "animate-spin" : ""}`} />
                <span>
                    {status.type === "running" ? "正在调用" : "调用了"} delete_nodes 工具
                </span>
            </div>
        );

        // Running state
        if (status.type === "running") {
            return <ToolCallIndicator />;
        }

        // Waiting for user confirmation
        if (status.type === "requires-action" || (typedResult?.pending && status.type === "complete")) {
            const nodes = typedResult?.nodes || [];
            const idsToDelete = nodes.map(n => n.id);
            // Generate a stable ID from the node IDs for persistence
            const confirmationId = `delete_${idsToDelete.sort().join('_').slice(0, 50)}`;

            return (
                <>
                    <ToolCallIndicator />
                    <DeleteConfirmation toolCallId={confirmationId} nodes={nodes} idsToDelete={idsToDelete} />
                </>
            );
        }

        // Completed state
        if (typedResult && !typedResult.pending) {
            if (typedResult.confirmed) {
                return (
                    <>
                        <ToolCallIndicator />
                        <div className="flex items-center gap-2 p-3 border rounded-lg text-destructive">
                            <Trash2 className="size-4" />
                            <span>已删除 {typedResult.deleted} 个节点</span>
                        </div>
                    </>
                );
            } else {
                return (
                    <>
                        <ToolCallIndicator />
                        <div className="flex items-center gap-2 p-3 border rounded-lg text-muted-foreground">
                            <X className="size-4" />
                            <span>已取消删除</span>
                        </div>
                    </>
                );
            }
        }

        return null;
    },
});
