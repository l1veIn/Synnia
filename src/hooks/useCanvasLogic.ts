import { useCallback } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';
import { NodeType } from '@/types/project';
import { toast } from 'sonner';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { apiClient } from '@/lib/apiClient';

export function useCanvasLogic() {
  const {
    addNode,
    onNodeDragStart: storeOnNodeDragStart,
    onNodeDragStop: storeOnNodeDragStop,
    setContextMenuTarget,
    handleAltDragStart,
    handleDragStopOpacity
  } = useWorkflowStore();

  const { pause, resume } = useHistory();
  const { fitView, getNodes } = useReactFlow();

  // --- Drag Logic ---
  const handleNodeDragStart = useCallback((event: any, _node: any, nodes: any[]) => {
    pause();
    
    // Alt + Drag to Duplicate (Ghost Effect)
    if (event.altKey) {
        resume(); // Enable history for the split action
        handleAltDragStart(_node.id);
        pause(); // Disable history again for movement
    }
    
    storeOnNodeDragStart(event, _node, nodes);
  }, [pause, resume, storeOnNodeDragStart, handleAltDragStart]);

  const handleNodeDragStop = useCallback((event: any, _node: any, nodes: any[]) => {
    // Reset opacity if it was changed (Alt Drag)
    handleDragStopOpacity(_node.id);
    
    resume();
    storeOnNodeDragStop(event, _node, nodes);
  }, [resume, storeOnNodeDragStop, handleDragStopOpacity]);

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
      // Check for Multi-Selection
      // React Flow usually selects the node on right click if not selected.
      // If it IS selected, and others are too, it's a multi-select action.
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
    (event: React.MouseEvent) => {
      setContextMenuTarget({
        type: 'canvas',
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [setContextMenuTarget]
  );

  const handleAddNode = useCallback((type: NodeType, pos?: XYPosition) => {
    if (pos) {
        addNode(type, pos);
    } else {
        const x = 100 + Math.random() * 50;
        const y = 100 + Math.random() * 50;
        addNode(type, { x, y });
    }
  }, [addNode]);

  const handleAddImage = useCallback(async (pos?: XYPosition) => {
      // Detect if in Tauri environment
      const isTauri = !!(window as any).__TAURI_INTERNALS__;

      if (isTauri) {
          try {
              const file = await open({
                  multiple: false,
                  filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
              });
              
              if (!file) return; // Cancelled
              const filePath = file as string;
              
              const toastId = toast.loading("Processing image...");

              // 1. Load Image for Metadata & Thumbnail (using convertFileSrc)
              const assetUrl = convertFileSrc(filePath);
              
              // Fetch Blob for Hash & Size
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
              
              // 2. Generate Thumbnail if large
              let thumbnail = undefined;
              const MAX_THUMB_SIZE = 400; // px
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

              // 3. Import File via Backend (Copy to project assets)
              // Returns relative path e.g. "assets/uuid.png"
              const relativePath = await apiClient.invoke<string>('import_file', { filePath });
              
              // 4. Create Node with Standard Dimensions (File Preview Mode)
              const STD_WIDTH = 240;
              const STD_HEIGHT = 240;

              const targetPos = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };
              
              addNode(NodeType.ASSET, targetPos, {
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
          // Browser Fallback (FileReader -> Base64)
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
                           addNode(NodeType.ASSET, targetPos, { 
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
  }, [addNode]);

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

