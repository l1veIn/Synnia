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
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";

interface EditorContextMenuProps {
  children: React.ReactNode;
}

export const EditorContextMenu = ({ children }: EditorContextMenuProps) => {
  const navigate = useNavigate();
  const contextMenuTarget = useWorkflowStore((state) => state.contextMenuTarget);
  const addNode = useWorkflowStore((state) => state.addNode);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const detachNode = useWorkflowStore((state) => state.detachNode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const pasteNodes = useWorkflowStore((state) => state.pasteNodes);
  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);
  const createShortcut = useWorkflowStore((state) => state.createShortcut);
  const createRackFromSelection = useWorkflowStore((state) => state.createRackFromSelection);
  
  const { screenToFlowPosition } = useReactFlow();
  
  const targetNode = contextMenuTarget?.id ? nodes.find(n => n.id === contextMenuTarget.id) : null;
  const hasParent = !!targetNode?.parentId;
  const parentNode = hasParent ? nodes.find(n => n.id === targetNode?.parentId) : null;
  const parentLabel = parentNode?.type === NodeType.RACK ? 'Rack' : 'Group';

  const handleAddNode = (type: NodeType) => {
    if (contextMenuTarget?.position) {
      const position = screenToFlowPosition({
        x: contextMenuTarget.position.x,
        y: contextMenuTarget.position.y,
      });
      addNode(type, position);
    }
  };
  
  const handleCreateRack = () => {
     createRackFromSelection();
  };

  const getClipboardNodes = (): SynniaNode[] => {
      try {
          const raw = localStorage.getItem('synnia-clipboard');
          if (raw) {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
          }
      } catch (e) { console.error("Clipboard parse error", e); }
      return [];
  };

  const repositionNodes = (nodes: SynniaNode[]) => {
      if (!contextMenuTarget?.position || nodes.length === 0) return nodes;
      
      const targetPos = screenToFlowPosition({
          x: contextMenuTarget.position.x,
          y: contextMenuTarget.position.y,
      });

      const minX = Math.min(...nodes.map(n => n.position.x));
      const minY = Math.min(...nodes.map(n => n.position.y));
      
      return nodes.map(n => ({
          ...n,
          position: { 
              x: targetPos.x + (n.position.x - minX), 
              y: targetPos.y + (n.position.y - minY) 
          }
      }));
  };

  const handlePaste = () => {
      const nodes = getClipboardNodes();
      if (nodes.length > 0) {
          pasteNodes(repositionNodes(nodes));
      }
  };

  const handleDetach = () => {
      if (contextMenuTarget?.id) {
          detachNode(contextMenuTarget.id);
      }
  };

  const handleDelete = () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
        selectedNodes.forEach(n => removeNode(n.id));
        return;
    }
    if (contextMenuTarget?.id) {
      removeNode(contextMenuTarget.id);
    }
  };
  
  const handleDuplicate = () => {
     const selectedNodes = nodes.filter(n => n.selected);
     if (selectedNodes.length > 0) {
         selectedNodes.forEach(n => duplicateNode(n));
         return;
     }

     if (contextMenuTarget?.id) {
        const node = nodes.find(n => n.id === contextMenuTarget.id);
        if (node) {
            duplicateNode(node);
        }
     }
  };

  const handleCreateShortcut = () => {
      if (contextMenuTarget?.id) {
          createShortcut(contextMenuTarget.id);
      }
  };

  const handleCopy = () => {
      if (contextMenuTarget?.id) {
        const node = nodes.find(n => n.id === contextMenuTarget.id);
        if(node) {
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
            <ContextMenuItem onSelect={handlePaste}>Paste</ContextMenuItem>
          </>
        )}

        {contextMenuTarget?.type === 'selection' && (
            <>
                <ContextMenuLabel>Selection Actions</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={handleCreateRack}>Create Rack</ContextMenuItem>
                <ContextMenuItem disabled>Group (Legacy)</ContextMenuItem>
                <ContextMenuSeparator />
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

        {(contextMenuTarget?.type === 'node' || contextMenuTarget?.type === 'group') && (
          <>
            <ContextMenuLabel>
                {contextMenuTarget.type === 'group' ? 'Group Actions' : 'Node Actions'}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            {hasParent && (
                <ContextMenuItem onSelect={handleDetach}>
                    Detach from {parentLabel}
                </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={handleDuplicate}>Duplicate</ContextMenuItem>
            {/* Only Asset Nodes can be shortcutted */}
            {targetNode?.type === NodeType.ASSET && (
                 <ContextMenuItem onSelect={handleCreateShortcut}>Create Shortcut</ContextMenuItem>
            )}
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
        
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => navigate('/')}>
             <Home className="w-4 h-4 mr-2" />
             Back to Home
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};