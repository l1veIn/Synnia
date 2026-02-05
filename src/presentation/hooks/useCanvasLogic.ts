import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/presentation/hooks/useHistory';
import { NodeType } from '@/presentation/types/project';
import { open } from '@tauri-apps/plugin-dialog';
import { graphEngine } from '@/presentation/engine/GraphEngine';
import { importHeavyNodeWithToast } from '@/lib/importHeavyNode';

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
    // Fit view to the double-clicked node
    fitView({ nodes: [node], minZoom: 1, duration: 500 });
  }, [fitView]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      const selectedNodes = getNodes().filter(n => n.selected);
      const isMultiSelect = selectedNodes.length > 1 && selectedNodes.some(n => n.id === node.id);

      setContextMenuTarget({
        type: isMultiSelect ? 'selection' : 'node',
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
    const position = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };
    graphEngine.mutator.createSmart({ value: {}, node: type, position });
  }, []);

  /**
   * Unified image addition handler.
   * Uses the new importHeavyNode interface for all import scenarios.
   * 
   * @param pos - Optional position for the new image node
   * @param file - Optional File object (for drag-drop scenarios). If provided, skips file dialog.
   */
  const handleAddImage = useCallback(async (pos?: XYPosition, file?: File) => {
    const targetPos = pos || { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 };

    // If a File is provided (drag-drop from web), use unified import
    if (file) {
      await importHeavyNodeWithToast(file, { position: targetPos });
      return;
    }

    // Otherwise, open file dialog
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      });

      if (!selected) return;
      const filePath = selected as string;

      // Use unified import with toast
      await importHeavyNodeWithToast(filePath, { position: targetPos });
    } else {
      // Web fallback: use file input dialog
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const selectedFile = (e.target as HTMLInputElement).files?.[0];
        if (selectedFile) {
          await importHeavyNodeWithToast(selectedFile, { position: targetPos });
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
