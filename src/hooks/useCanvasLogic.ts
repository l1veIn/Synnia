import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';
import { NodeType } from '@/types/project';
import { toast } from 'sonner';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { apiClient } from '@/lib/apiClient';
import { graphEngine } from '@/lib/engine/GraphEngine';

export function useCanvasLogic() {
  const setContextMenuTarget = useWorkflowStore(s => s.setContextMenuTarget);
  const { pause, resume } = useHistory();
  const { fitView, getNodes } = useReactFlow();

  // --- Drag Logic ---
  const handleNodeDragStart = useCallback((event: any, _node: any, nodes: any[]) => {
    pause();

    // Alt + Drag to Duplicate (Ghost Effect)
    if (event.altKey) {
      resume();
      graphEngine.interaction.handleAltDragStart(_node.id);
      pause();
    }
  }, [pause, resume]);

  const handleNodeDragStop = useCallback((event: any, _node: any, nodes: any[]) => {
    graphEngine.interaction.handleDragStopOpacity(_node.id);
    // Call the full onNodeDragStop handler (includes docking logic)
    graphEngine.interaction.onNodeDragStop(event, _node, nodes);
    resume();
  }, [resume]);

  // --- Interaction Logic ---
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: any) => {
    if (node.type === NodeType.GROUP) {
      fitView({ nodes: [node], padding: 0.2, duration: 800 });
    } else {
      fitView({ nodes: [node], minZoom: 1, duration: 500 });
    }
  }, [fitView]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      const selectedNodes = getNodes().filter(n => n.selected);
      const isMultiSelect = selectedNodes.length > 1 && selectedNodes.some(n => n.id === node.id);

      setContextMenuTarget({
        type: isMultiSelect ? 'selection' : (node.type === NodeType.GROUP ? 'group' : 'node'),
        id: node.id,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [setContextMenuTarget, getNodes]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      setContextMenuTarget({
        type: 'canvas',
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [setContextMenuTarget]
  );

  const handleAddNode = useCallback((type: NodeType, pos?: XYPosition) => {
    if (pos) {
      graphEngine.mutator.addNode(type, pos);
    } else {
      const x = 100 + Math.random() * 50;
      const y = 100 + Math.random() * 50;
      graphEngine.mutator.addNode(type, { x, y });
    }
  }, []);

  const handleAddImage = useCallback(async (pos?: XYPosition) => {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const file = await open({
          multiple: false,
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
        });

        if (!file) return;
        const filePath = file as string;

        const toastId = toast.loading("Processing image...");

        // Import file via backend (saves file and generates thumbnail)
        const result = await apiClient.importFile(filePath);

        const STD_WIDTH = 240;
        const STD_HEIGHT = 240;
        const targetPos = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };

        graphEngine.mutator.addNode(NodeType.IMAGE, targetPos, {
          assetType: 'image',
          content: result.relativePath,
          assetName: filePath.split(/[/\\]/).pop(),
          metadata: {
            image: {
              width: result.width,
              height: result.height,
              thumbnail: result.thumbnailPath || undefined
            }
          },
          style: { width: STD_WIDTH, height: STD_HEIGHT }
        });

        toast.success("Image imported", { id: toastId });

      } catch (e) {
        console.error(e);
        toast.error("Import failed: " + String(e));
      }
    } else {
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
              const targetPos = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };
              graphEngine.mutator.addNode(NodeType.IMAGE, targetPos, {
                assetType: 'image',
                content: base64 as string,
                assetName: file.name
              });
              toast.success("Image added (Base64)", { id: toastId });
            } else {
              toast.error("Failed to read file", { id: toastId });
            }
          };
          reader.onerror = () => toast.error("Failed to read file", { id: toastId });
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  }, []);

  return {
    handleNodeDragStart,
    handleNodeDragStop,
    onNodeDoubleClick,
    onNodeContextMenu,
    onPaneContextMenu,
    handleAddNode,
    handleAddImage
  };
}
