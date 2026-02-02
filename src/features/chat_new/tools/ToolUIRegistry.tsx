/**
 * ToolUIRegistry - Tool UI components for agent_new module.
 *
 * This module registers all tool UI components for rendering tool calls
 * and their results in the chat interface.
 *
 * Reference: src/features/chat/tools/ChatToolsProvider.tsx
 */

import { ReactNode } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { List } from 'lucide-react';

// =============================================================================
// GetNodesList Tool UI
// =============================================================================

export interface NodeInfo {
  id: string;
  type: string;
  title: string;
  state: string;
  position: { x: number; y: number };
  assetId?: string;
  hasContent: boolean;
  contentPreview?: string;
}

export const GetNodesListToolUI = makeAssistantToolUI({
  toolName: 'get_nodes_list',
  render: ({ result, status }) => {
    const ToolCallIndicator = () => (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <List className={`size-3 ${status.type === 'running' ? 'animate-spin' : ''}`} />
        <span>
          {status.type === 'running' ? 'Querying' : 'Queried'} get_nodes_list tool
        </span>
      </div>
    );

    if (status.type === 'running') {
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

// =============================================================================
// Tool UI Provider
// =============================================================================

interface ToolUIRegistryProps {
  children: ReactNode;
}

/**
 * ToolUIRegistry - Provider for all tool UI components.
 *
 * This provider registers tool UI components with assistant-ui
 * for rendering tool calls and results.
 */
export function ToolUIRegistry({ children }: ToolUIRegistryProps) {
  // Note: In assistant-ui, tool UIs are registered differently
  // The makeAssistantToolUI components are used with the ToolRenderContext
  // This is a placeholder provider for future registration patterns
  return <>{children}</>;
}
