import { useCallback } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';
import { NodeType } from '@/types/project';

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
  const { fitView } = useReactFlow();

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
      setContextMenuTarget({
        type: node.type === NodeType.GROUP ? 'group' : 'node',
        id: node.id,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [setContextMenuTarget]
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
        // Default offset logic
        const x = 100 + Math.random() * 50;
        const y = 100 + Math.random() * 50;
        addNode(type, { x, y });
    }
  }, [addNode]);

  return {
    handleNodeDragStart,
    handleNodeDragStop,
    onNodeDoubleClick,
    onNodeContextMenu,
    onPaneContextMenu,
    handleAddNode
  };
}
