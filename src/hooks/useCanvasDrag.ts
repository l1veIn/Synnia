import { useRef, useCallback } from 'react';
import { useReactFlow, Node, NodeDragHandler } from '@xyflow/react';
import { useProjectStore } from '@/store/projectStore';
import { isNodeInside } from '@/lib/layoutUtils';
import { UIAssetNodeData } from '@/components/nodes/AssetNode';

export function useCanvasDrag() {
    const { getNodes, setNodes } = useReactFlow();
    const updateNodeData = useProjectStore(state => state.updateNodeData);
    const updateNodeParent = useProjectStore(state => state.updateNodeParent);
    
    const dragTargetRef = useRef<{ targetId: string | null; enterTime: number | null }>({ 
        targetId: null, 
        enterTime: null 
    });
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const onNodeDrag: NodeDragHandler = useCallback((event, node) => {
        const nodes = getNodes();
        const targetNode = nodes.find((n) => 
            n.id !== node.id && 
            n.data.assetType === 'collection_asset' &&
            isNodeInside(node, n)
        );

        const currentTargetId = targetNode?.id || null;
        const prevTargetId = dragTargetRef.current.targetId;

        // Case 1: Entering a new target
        if (currentTargetId && currentTargetId !== prevTargetId) {
            // Cleanup previous
            if (prevTargetId) {
                setNodes((nds) => nds.map((n) => 
                    n.id === prevTargetId ? { ...n, data: { ...n.data, dropTargetState: 'none' } } : n
                ));
            }
            if (timerRef.current) clearTimeout(timerRef.current);

            // Set new target to 'hover'
            dragTargetRef.current = { targetId: currentTargetId, enterTime: Date.now() };
            setNodes((nds) => nds.map((n) => 
                n.id === currentTargetId ? { ...n, data: { ...n.data, dropTargetState: 'hover' } } : n
            ));

            // Start Timer for 'ready' state
            timerRef.current = setTimeout(() => {
                setNodes((nds) => nds.map((n) => 
                    n.id === currentTargetId ? { ...n, data: { ...n.data, dropTargetState: 'ready' } } : n
                ));
            }, 500);
        }
        // Case 3: Left a target
        else if (!currentTargetId && prevTargetId) {
            if (timerRef.current) clearTimeout(timerRef.current);
            
            setNodes((nds) => nds.map((n) => 
                n.id === prevTargetId ? { ...n, data: { ...n.data, dropTargetState: 'none' } } : n
            ));
            dragTargetRef.current = { targetId: null, enterTime: null };
        }
    }, [getNodes, setNodes]);

    const onNodeDragStop: NodeDragHandler = useCallback((event, node) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        
        const { targetId } = dragTargetRef.current;
        
        if (targetId) {
            // We can check the state of the target node to see if it was ready
            // But since we have the timer, we can also check duration or just trust the timer execution.
            // Safer to check if sufficient time passed manually to avoid race conditions with React state updates.
            const hoverDuration = Date.now() - (dragTargetRef.current.enterTime || 0);
            
            if (hoverDuration >= 500) {
                console.log(`Dropped node ${node.id} into collection ${targetId}`);
                updateNodeParent(node.id, targetId);
            } else {
                console.log(`Drop ignored (hover too short: ${hoverDuration}ms)`);
            }

            // Cleanup visual state
            setNodes((nds) => nds.map((n) => {
                if (n.id === targetId) {
                    return { ...n, data: { ...n.data, dropTargetState: 'none' } };
                }
                return n;
            }));
        }
        
        dragTargetRef.current = { targetId: null, enterTime: null };
    }, [updateNodeParent, setNodes]);

    return {
        onNodeDrag,
        onNodeDragStop
    };
}