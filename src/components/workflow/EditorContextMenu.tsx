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
import { nodesConfig } from "./nodes";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { toast } from "sonner";
import { graphEngine } from "@/lib/engine/GraphEngine";

interface EditorContextMenuProps {
  children: React.ReactNode;
}

export const EditorContextMenu = ({ children }: EditorContextMenuProps) => {
  const navigate = useNavigate();
  const contextMenuTarget = useWorkflowStore((state) => state.contextMenuTarget);
  const nodes = useWorkflowStore((state) => state.nodes);

  const { screenToFlowPosition } = useReactFlow();

  const targetNode = contextMenuTarget?.id ? nodes.find(n => n.id === contextMenuTarget.id) : null;
  const hasParent = !!targetNode?.parentId;
  const parentNode = hasParent ? nodes.find(n => n.id === targetNode?.parentId) : null;
  const parentLabel = parentNode ? 'Container' : '';

  const isShortcuttable = targetNode && [NodeType.ASSET, NodeType.TEXT, NodeType.IMAGE, NodeType.JSON, NodeType.RECIPE].includes(targetNode.type as NodeType);

  const handleAddNode = (type: NodeType) => {
    if (contextMenuTarget?.position) {
      const position = screenToFlowPosition({
        x: contextMenuTarget.position.x,
        y: contextMenuTarget.position.y,
      });
      graphEngine.mutator.addNode(type, position);
    }
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const toastId = toast.loading("Importing image...");

        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result;
          if (base64) {
            const position = contextMenuTarget?.position
              ? screenToFlowPosition({
                x: contextMenuTarget.position.x,
                y: contextMenuTarget.position.y,
              })
              : { x: 100, y: 100 };

            graphEngine.mutator.addNode(NodeType.ASSET, position, {
              assetType: 'image',
              content: base64 as string,
              assetName: file.name
            });
            toast.success("Image added", { id: toastId });
          } else {
            toast.error("Failed to read file", { id: toastId });
          }
        };
        reader.onerror = () => toast.error("Failed to read file", { id: toastId });
        reader.readAsDataURL(file);
      }
    };
    input.click();
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
      graphEngine.mutator.pasteNodes(repositionNodes(nodes));
    }
  };

  const handleDetach = () => {
    if (contextMenuTarget?.id) {
      graphEngine.mutator.detachNode(contextMenuTarget.id);
    }
  };

  const handleDelete = () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      selectedNodes.forEach(n => graphEngine.mutator.removeNode(n.id));
      return;
    }
    if (contextMenuTarget?.id) {
      graphEngine.mutator.removeNode(contextMenuTarget.id);
    }
  };

  const handleDuplicate = () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      selectedNodes.forEach(n => graphEngine.mutator.duplicateNode(n));
      return;
    }

    if (contextMenuTarget?.id) {
      const node = nodes.find(n => n.id === contextMenuTarget.id);
      if (node) {
        graphEngine.mutator.duplicateNode(node);
      }
    }
  };

  const handleCreateShortcut = () => {
    if (contextMenuTarget?.id) {
      graphEngine.mutator.createShortcut(contextMenuTarget.id);
    }
  };

  const handleCopy = () => {
    if (contextMenuTarget?.id) {
      const node = nodes.find(n => n.id === contextMenuTarget.id);
      if (node) {
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
                {Object.entries(nodesConfig)
                  .filter(([_, config]) => !config.hidden)
                  .map(([type, config]) => (
                    <ContextMenuItem key={type} onSelect={() => handleAddNode(type as NodeType)}>
                      {config.title}
                    </ContextMenuItem>
                  ))}
                <ContextMenuItem onSelect={handleAddImage}>
                  Image
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onSelect={handlePaste}>Paste</ContextMenuItem>
          </>
        )}

        {contextMenuTarget?.type === 'selection' && (
          <>
            <ContextMenuLabel>Selection Actions</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem disabled>Create Group (Deprecated)</ContextMenuItem>
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
            {isShortcuttable && (
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