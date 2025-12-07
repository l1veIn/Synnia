import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import { useWorkflowStore } from "@/store/workflowStore";
import { useReactFlow } from "@xyflow/react";
import { NodeType, SynniaNode } from "@/types/project";
import { nodesConfig } from "./nodes/registry";
import { v4 as uuidv4 } from "uuid";

interface EditorContextMenuProps {
  children: React.ReactNode;
}

export const EditorContextMenu = ({ children }: EditorContextMenuProps) => {
  const contextMenuTarget = useWorkflowStore((state) => state.contextMenuTarget);
  const addNode = useWorkflowStore((state) => state.addNode);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const detachNode = useWorkflowStore((state) => state.detachNode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const pasteNodes = useWorkflowStore((state) => state.pasteNodes);
  
  const { screenToFlowPosition } = useReactFlow();
  
  const targetNode = contextMenuTarget?.id ? nodes.find(n => n.id === contextMenuTarget.id) : null;
  const hasParent = !!targetNode?.parentId;

  const handleAddNode = (type: NodeType) => {
    if (contextMenuTarget?.position) {
      const position = screenToFlowPosition({
        x: contextMenuTarget.position.x,
        y: contextMenuTarget.position.y,
      });
      addNode(type, position);
    }
  };

  const handleDetach = () => {
      if (contextMenuTarget?.id) {
          detachNode(contextMenuTarget.id);
      }
  };

  const handleDelete = () => {
    if (contextMenuTarget?.id) {
      removeNode(contextMenuTarget.id);
    }
  };
  
  const handleDuplicate = () => {
     if (contextMenuTarget?.id) {
        const node = nodes.find(n => n.id === contextMenuTarget.id);
        if (node) {
            const newId = uuidv4();
            // Shallow clone is fine for basic nodes, but careful with data
            const newNode: SynniaNode = {
                ...node,
                id: newId,
                // Offset slightly
                position: { x: node.position.x + 20, y: node.position.y + 20 },
                selected: true,
                data: { ...JSON.parse(JSON.stringify(node.data)) }
            };
            // Use pasteNodes to handle selection/history properly
            pasteNodes([newNode]);
        }
     }
  };

  const handleCopy = () => {
      if (contextMenuTarget?.id) {
        const node = nodes.find(n => n.id === contextMenuTarget.id);
        if(node) {
             // TODO: Use the recursive copy helper from hooks if available
             // For now, simple copy
             localStorage.setItem('synnia-clipboard', JSON.stringify([node]));
             console.log('Copied node to clipboard');
        }
      }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block h-full w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {contextMenuTarget?.type === 'canvas' && (
          <>
            <ContextMenuLabel>Canvas Actions</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Add Node</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {Object.entries(nodesConfig).map(([type, config]) => (
                  <ContextMenuItem key={type} onSelect={() => handleAddNode(type as NodeType)}>
                    {config.title}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem disabled>Paste (Cmd+V)</ContextMenuItem>
          </>
        )}

        {(contextMenuTarget?.type === 'node' || contextMenuTarget?.type === 'group') && (
          <>
            <ContextMenuLabel>
                {contextMenuTarget.type === 'group' ? 'Group Actions' : 'Node Actions'}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            {hasParent && (
                <ContextMenuItem onSelect={handleDetach}>
                    Detach from Group
                </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={handleDuplicate}>Duplicate</ContextMenuItem>
            <ContextMenuItem onSelect={handleCopy}>Copy</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
                onSelect={handleDelete} 
                className="text-red-600 focus:text-red-600"
            >
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
