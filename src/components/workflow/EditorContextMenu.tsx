import React, { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useWorkflowStore } from "@/store/workflowStore";
import { useReactFlow } from "@xyflow/react";
import { NodeType, SynniaNode } from "@/types/project";
import { useNavigate } from "react-router-dom";
import { Home, Image } from "lucide-react";
import { toast } from "sonner";
import { graphEngine } from "@core/engine/GraphEngine";
import { NodePicker, NodePickerItem } from "./NodePicker";
import { useTranslation } from "react-i18next";
import { useCanvasLogic } from '@/hooks/useCanvasLogic';
import { apiClient } from "@/lib/apiClient";

interface EditorContextMenuProps {
  children: React.ReactNode;
}

export const EditorContextMenu = ({ children }: EditorContextMenuProps) => {
  const { t } = useTranslation('canvas');
  const navigate = useNavigate();
  const contextMenuTarget = useWorkflowStore((state) => state.contextMenuTarget);
  const nodes = useWorkflowStore((state) => state.nodes);

  const { handleAddImage, handleAddNode } = useCanvasLogic();

  const { screenToFlowPosition } = useReactFlow();

  const targetNode = contextMenuTarget?.id ? nodes.find(n => n.id === contextMenuTarget.id) : null;

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

  const handleCopy = () => {
    if (contextMenuTarget?.id) {
      const node = nodes.find(n => n.id === contextMenuTarget.id);
      if (node) {
        localStorage.setItem('synnia-clipboard', JSON.stringify([node]));
      }
    }
  };

  const [nodePickerOpen, setNodePickerOpen] = useState(false);

  const handleNodePickerSelect = (item: NodePickerItem) => {
    const position = contextMenuTarget?.position
      ? screenToFlowPosition({
        x: contextMenuTarget.position.x,
        y: contextMenuTarget.position.y,
      })
      : { x: 150, y: 150 };

    if (item.action === 'import-file') {
      handleAddImage();
    } else if (item.recipeId) {
      graphEngine.mutator.createSmart({ value: {}, node: `recipe:${item.recipeId}`, position });
    } else if (item.nodeType) {
      handleAddNode(item.nodeType);
    }
    setNodePickerOpen(false);
  };

  // Check if target node is an image node
  const isImageNode = targetNode?.type === 'image';
  const assets = useWorkflowStore((state) => state.assets);

  const handleSetAsThumbnail = async () => {
    if (!targetNode?.data?.assetId) {
      toast.error(t('contextMenu.noAssetFound'));
      return;
    }

    const asset = assets[targetNode.data.assetId];
    if (!asset) {
      toast.error(t('contextMenu.assetMissing'));
      return;
    }

    // Get the image path from asset.value (supports both { src: ... } and string formats)
    let imagePath: string | undefined;
    if (typeof asset.value === 'object' && asset.value !== null && 'src' in asset.value) {
      imagePath = (asset.value as any).src;
    } else if (typeof asset.value === 'string') {
      imagePath = asset.value;
    }

    if (!imagePath) {
      toast.error(t('contextMenu.invalidAsset'));
      return;
    }

    const toastId = toast.loading(t('contextMenu.settingThumbnail'));
    try {
      await apiClient.invoke('set_thumbnail', { imageRelativePath: imagePath });
      toast.success(t('contextMenu.thumbnailSet'), { id: toastId });
    } catch (e) {
      console.error('Failed to set thumbnail:', e);
      toast.error(t('contextMenu.thumbnailFailed'), { id: toastId });
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="block h-full w-full">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          {contextMenuTarget?.type === 'canvas' && (
            <>
              <ContextMenuLabel>{t('contextMenu.canvasActions')}</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => setNodePickerOpen(true)}>
                {t('contextMenu.addNode')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={handlePaste}>{t('contextMenu.paste')}</ContextMenuItem>
            </>
          )}

          {contextMenuTarget?.type === 'selection' && (
            <>
              <ContextMenuLabel>{t('contextMenu.selectionActions')}</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleDuplicate}>{t('contextMenu.duplicate')}</ContextMenuItem>
              <ContextMenuItem onSelect={handleCopy}>{t('contextMenu.copy')}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                {t('contextMenu.delete')}
              </ContextMenuItem>
            </>
          )}

          {contextMenuTarget?.type === 'node' && (
            <>
              <ContextMenuLabel>{t('contextMenu.nodeActions')}</ContextMenuLabel>
              <ContextMenuSeparator />
              {isImageNode && (
                <>
                  <ContextMenuItem onSelect={handleSetAsThumbnail}>
                    <Image className="w-4 h-4 mr-2" />
                    {t('contextMenu.setAsThumbnail')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onSelect={handleDuplicate}>{t('contextMenu.duplicate')}</ContextMenuItem>
              <ContextMenuItem onSelect={handleCopy}>{t('contextMenu.copy')}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                {t('contextMenu.delete')}
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => navigate('/')}>
            <Home className="w-4 h-4 mr-2" />
            {t('contextMenu.backToHome')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* NodePicker Dialog */}
      <Dialog open={nodePickerOpen} onOpenChange={setNodePickerOpen}>
        <DialogContent className="max-w-md p-0">
          <VisuallyHidden>
            <DialogTitle>{t('nodePicker.title')}</DialogTitle>
          </VisuallyHidden>
          <NodePicker
            onSelect={handleNodePickerSelect}
            onClose={() => setNodePickerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};