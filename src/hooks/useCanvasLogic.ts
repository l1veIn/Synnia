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

        const assetUrl = convertFileSrc(filePath);
        const response = await fetch(assetUrl);
        const blob = await response.blob();
        const hashBuffer = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = assetUrl;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Failed to load image structure"));
        });

        let thumbnail = undefined;
        const MAX_THUMB_SIZE = 400;
        if (img.width > MAX_THUMB_SIZE || img.height > MAX_THUMB_SIZE) {
          const canvas = document.createElement('canvas');
          const scale = Math.min(MAX_THUMB_SIZE / img.width, MAX_THUMB_SIZE / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          }
        }

        const relativePath = await apiClient.invoke<string>('import_file', { filePath });

        const STD_WIDTH = 240;
        const STD_HEIGHT = 240;

        const targetPos = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };

        graphEngine.mutator.addNode(NodeType.ASSET, targetPos, {
          assetType: 'image',
          content: relativePath,
          assetName: filePath.split(/[/\\]/).pop(),
          metadata: {
            image: {
              width: img.width,
              height: img.height,
              mimeType: blob.type || 'image/png',
              size: blob.size,
              hash: hash,
              thumbnail
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
              graphEngine.mutator.addNode(NodeType.ASSET, targetPos, {
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
