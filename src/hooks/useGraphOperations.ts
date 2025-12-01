import { useCallback, useRef } from 'react';
import { Node, Edge, Connection, NodeDragHandler, useReactFlow, Edge as FlowEdge } from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { AssetNode as RustAssetNode, Edge as RustEdge } from '@/types/synnia';
import { AssetNodeData } from '@/components/nodes/AssetNode';
import { SyncStatus } from './useCanvasSync';
import { getLayoutedElements } from '@/lib/layoutUtils';

interface UseGraphOperationsProps {
    nodes: Node<AssetNodeData>[];
    setNodes: (nodes: Node<AssetNodeData>[] | ((nodes: Node<AssetNodeData>[]) => Node<AssetNodeData>[])) => void;
    edges: Edge[];
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
    record: (command: any) => void;
    wrapSync: (promise: Promise<any>) => Promise<void>;
    setSyncStatus: (status: SyncStatus) => void;
}

interface SynniaClipboard {
    synnia_v: number;
    nodes: {
        id: string; // original id for mapping
        type: string;
        x: number;
        y: number;
        w?: number;
        h?: number;
        payload: string;
    }[];
    edges: {
        source: string;
        target: string;
    }[];
}

export function useGraphOperations({
    nodes,
    setNodes,
    edges,
    setEdges,
    record,
    wrapSync,
    setSyncStatus
}: UseGraphOperationsProps) {
    const { screenToFlowPosition } = useReactFlow();
    
    // Refs for Drag Logic
    const dragStartPositions = useRef<Record<string, {x: number, y: number}>>({});
    const pendingMoves = useRef<{id: string, oldPos: {x: number, y: number}, newPos: {x: number, y: number}}[]>([]);
    const batchTimeout = useRef<NodeJS.Timeout | null>(null);

    // --- Node Operations ---

    const handleAddNode = useCallback(async (type: string, pos?: {x: number, y: number}) => {
        try {
            const x = pos ? pos.x : Math.random() * 400;
            const y = pos ? pos.y : Math.random() * 400;
            
            setSyncStatus('saving');
            const node = await invoke<RustAssetNode>('create_node', { 
                projectId: "demo", 
                nodeType: type, 
                x, 
                y,
                payload: null // Use default
            });
            
            let payload = "";
            if (type === "Text") payload = "New text note";
            if (type === "Prompt") payload = "Enter prompt here...";
            
            record({
                undo: async () => {
                    await invoke('delete_node', { id: node.id });
                },
                redo: async () => {
                    await invoke('restore_node', {
                        id: node.id,
                        projectId: "demo",
                        nodeType: type,
                        x,
                        y,
                        width: undefined, 
                        height: undefined,
                        payload
                    });
                }
            });
    
            toast.success(`Created ${type} Node`);
            setSyncStatus('saved');
        } catch (e) {
            setSyncStatus('error');
            toast.error(`Error: ${e}`);
        }
    }, [record, setSyncStatus]);

    const handleDeleteSelection = useCallback(async (selectedNodeId?: string | null, setSelNodeId?: (id: string|null) => void) => {
        let selectedNodes = nodes.filter(n => n.selected);
        
        if (selectedNodeId && !selectedNodes.find(n => n.id === selectedNodeId)) {
             const target = nodes.find(n => n.id === selectedNodeId);
             if (target) selectedNodes = [target];
        }

        if (selectedNodes.length === 0) return;

        const undoDataList = selectedNodes.map(node => ({
            id: node.id,
            projectId: "demo",
            nodeType: node.data.type,
            x: node.position.x,
            y: node.position.y,
            width: typeof node.style?.width === 'number' ? node.style.width : undefined,
            height: typeof node.style?.height === 'number' ? node.style.height : undefined,
            payload: node.data.preview || ""
        }));

        record({
            undo: async () => {
                for (const data of undoDataList) {
                    await invoke('restore_node', data);
                }
            },
            redo: async () => {
                for (const node of selectedNodes) {
                    await invoke('delete_node', { id: node.id });
                }
            }
        });

        try {
            await wrapSync(Promise.all(selectedNodes.map(n => 
               invoke('delete_node', { id: n.id })
            )));
            if (setSelNodeId) setSelNodeId(null);
        } catch (e) {
            toast.error(`Failed to delete: ${e}`);
        }
    }, [nodes, record, wrapSync]);

    const onNodesDelete = useCallback(async (deletedNodes: Node<AssetNodeData>[]) => {
        const restoreCommands = deletedNodes.map(node => ({
            id: node.id,
            projectId: "demo",
            nodeType: node.data.type,
            x: node.position.x,
            y: node.position.y,
            width: typeof node.style?.width === 'number' ? node.style.width : undefined,
            height: typeof node.style?.height === 'number' ? node.style.height : undefined,
            payload: node.data.preview || ""
        }));
  
        record({
            undo: async () => {
                for (const cmd of restoreCommands) {
                    await invoke('restore_node', cmd);
                }
            },
            redo: async () => {
                for (const node of deletedNodes) {
                    await invoke('delete_node', { id: node.id });
                }
            }
        });
  
        await wrapSync(Promise.all(deletedNodes.map(node => 
            invoke('delete_node', { id: node.id })
        )));
    }, [record, wrapSync]);

    // --- Copy & Paste ---

    const handleCopy = useCallback(async () => {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedIds = new Set(selectedNodes.map(n => n.id));
        
        // Find internal edges
        const internalEdges = edges.filter(e => 
            selectedIds.has(e.source) && selectedIds.has(e.target)
        );

        const clipboardData: SynniaClipboard = {
            synnia_v: 1,
            nodes: selectedNodes.map(n => ({
                id: n.id,
                type: n.data.type,
                x: n.position.x,
                y: n.position.y,
                w: typeof n.style?.width === 'number' ? n.style.width : undefined,
                h: typeof n.style?.height === 'number' ? n.style.height : undefined,
                payload: n.data.preview || ""
            })),
            edges: internalEdges.map(e => ({
                source: e.source,
                target: e.target
            }))
        };

        try {
            // Use internal storage to avoid permission issues
            localStorage.setItem('synnia_clipboard', JSON.stringify(clipboardData));
            toast.success(`Copied ${selectedNodes.length} items`);
        } catch (e) {
            console.error("Copy failed", e);
            toast.error("Failed to copy");
        }
    }, [nodes, edges]);

    const handlePaste = useCallback(async () => {
        try {
            const text = localStorage.getItem('synnia_clipboard');
            if (!text) return;

            let data: SynniaClipboard;
            try {
                data = JSON.parse(text);
            } catch { return; } 

            if (data.synnia_v !== 1 || !Array.isArray(data.nodes)) return;

            setSyncStatus('saving');
            const idMap = new Map<string, string>(); // OldID -> NewID
            const createdNodes: any[] = [];
            const createdEdges: any[] = [];

            // Paste offset (e.g. +50px) so user sees the new items
            // Better: if mouse pos is available, paste there? 
            // For now simple offset is fine.
            const offset = 50;

            // 1. Create Nodes
            for (const nodeData of data.nodes) {
                const newNode = await invoke<RustAssetNode>('create_node', {
                    projectId: "demo",
                    nodeType: nodeData.type,
                    x: nodeData.x + offset,
                    y: nodeData.y + offset,
                    payload: nodeData.payload
                });
                
                idMap.set(nodeData.id, newNode.id);
                createdNodes.push({
                    ...newNode,
                    // Store extra data needed for undo
                    undoData: {
                        id: newNode.id,
                        projectId: "demo",
                        nodeType: nodeData.type,
                        x: nodeData.x + offset,
                        y: nodeData.y + offset,
                        width: nodeData.w,
                        height: nodeData.h,
                        payload: nodeData.payload
                    }
                });

                if (nodeData.w && nodeData.h) {
                    await invoke('update_node_size', { 
                        id: newNode.id, 
                        width: nodeData.w, 
                        height: nodeData.h 
                    });
                }
            }

            // 2. Create Edges
            for (const edgeData of data.edges) {
                const newSource = idMap.get(edgeData.source);
                const newTarget = idMap.get(edgeData.target);
                
                if (newSource && newTarget) {
                    const newEdge = await invoke<RustEdge>('create_edge', {
                        sourceId: newSource,
                        targetId: newTarget
                    });
                    createdEdges.push(newEdge);
                }
            }

            // 3. Record Undo
            record({
                undo: async () => {
                    for (const e of createdEdges) {
                        await invoke('delete_edge', { id: e.id });
                    }
                    for (const n of createdNodes) {
                        await invoke('delete_node', { id: n.id });
                    }
                },
                redo: async () => {
                    for (const n of createdNodes) {
                        await invoke('restore_node', n.undoData);
                    }
                    for (const e of createdEdges) {
                        await invoke('restore_edge', { 
                            id: e.id, 
                            sourceId: e.source_id, 
                            targetId: e.target_id 
                        });
                    }
                }
            });

            toast.success(`Pasted ${createdNodes.length} items`);
            setSyncStatus('saved');

        } catch (e) {
            setSyncStatus('error');
            console.error("Paste failed", e);
            toast.error("Paste failed");
        }
    }, [record, setSyncStatus]);

    // --- Resize Operations ---

    const handleNodeResizeCommit = useCallback(async (nodeId: string, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number) => {
        record({
            undo: async () => {
                await invoke('update_node_size', { id: nodeId, width: oldWidth, height: oldHeight });
            },
            redo: async () => {
                await invoke('update_node_size', { id: nodeId, width: newWidth, height: newHeight });
            }
        });
        try {
            await wrapSync(invoke('update_node_size', { id: nodeId, width: newWidth, height: newHeight }));
        } catch (e) {
            console.error("Failed to update node size", e);
        }
    }, [record, wrapSync]);

    // --- Move Operations (Batched) ---

    const onNodeDragStart: NodeDragHandler = useCallback((_event, _node) => {
        const selectedNodes = nodes.filter(n => n.selected);
        selectedNodes.forEach(n => {
            dragStartPositions.current[n.id] = { x: n.position.x, y: n.position.y };
        });
        if (!dragStartPositions.current[_node.id]) {
             dragStartPositions.current[_node.id] = { x: _node.position.x, y: _node.position.y };
        }
    }, [nodes]);
  
    const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
        const oldPos = dragStartPositions.current[node.id];
        const newPos = node.position;
  
        if (oldPos && (Math.abs(oldPos.x - newPos.x) > 0.1 || Math.abs(oldPos.y - newPos.y) > 0.1)) {
            pendingMoves.current.push({ id: node.id, oldPos, newPos });
        }
  
        if (batchTimeout.current) {
            clearTimeout(batchTimeout.current);
        }
  
        batchTimeout.current = setTimeout(async () => {
            const moves = [...pendingMoves.current];
            pendingMoves.current = []; 
            
            if (moves.length === 0) return;
  
            record({
                undo: async () => {
                    for (const move of moves) {
                        await invoke('update_node_pos', { id: move.id, x: move.oldPos.x, y: move.oldPos.y });
                    }
                },
                redo: async () => {
                    for (const move of moves) {
                        await invoke('update_node_pos', { id: move.id, x: move.newPos.x, y: move.newPos.y });
                    }
                }
            });
  
            try {
                await wrapSync(Promise.all(moves.map(m => 
                    invoke('update_node_pos', { id: m.id, x: m.newPos.x, y: m.newPos.y })
                )));
            } catch (e) {
                console.error("Batch move sync failed", e);
            }
        }, 50);
    }, [wrapSync, record]);

    // --- Edge Operations ---

    const onConnect = useCallback(async (params: Connection) => {
        try {
            if (params.source && params.target) {
                setSyncStatus('saving');
                const edge = await invoke<RustEdge>('create_edge', { 
                    sourceId: params.source, 
                    targetId: params.target 
                });
                
                record({
                    undo: async () => {
                        await invoke('delete_edge', { id: edge.id });
                    },
                    redo: async () => {
                        await invoke('restore_edge', { 
                            id: edge.id, 
                            sourceId: edge.source_id, 
                            targetId: edge.target_id 
                        });
                    }
                });
    
                toast.success("Linked!");
                setSyncStatus('saved');
            }
        } catch (e) {
            setSyncStatus('error');
            toast.error(`Failed to link: ${e}`);
        }
    }, [record, setSyncStatus]);
    
    const onEdgesDelete = useCallback(async (edges: FlowEdge[]) => {
        const edgesToRestore = edges.map(e => ({
            id: e.id,
            sourceId: e.source,
            targetId: e.target
        }));
  
        record({
            undo: async () => {
                for (const e of edgesToRestore) {
                    await invoke('restore_edge', { id: e.id, sourceId: e.sourceId, targetId: e.targetId });
                }
            },
            redo: async () => {
                for (const e of edgesToRestore) {
                    await invoke('delete_edge', { id: e.id });
                }
            }
        });
  
        try {
            setSyncStatus('saving');
            await Promise.all(edges.map(e => invoke('delete_edge', { id: e.id })));
            setSyncStatus('saved');
        } catch (e) {
            setSyncStatus('error');
            toast.error(`Failed to delete edges: ${e}`);
        }
    }, [record, setSyncStatus]);

    // --- Other ---

    const onLayout = useCallback(async (direction: 'TB' | 'LR') => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          nodes,
          edges,
          direction
        );
    
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        
        toast.info("Layout applied. Drag nodes to save new positions.");
        
        for (const node of layoutedNodes) {
            invoke('update_node_pos', { id: node.id, x: node.position.x, y: node.position.y }).catch(console.error);
        }
    }, [nodes, edges, setNodes, setEdges]);

    const handleImportFiles = useCallback(async (files: string[]) => {
        toast.info(`Importing ${files.length} file(s)...`);
        for (const file of files) {
            try {
                await invoke('import_file', { filePath: file });
            } catch (e) {
                toast.error(`Failed to import ${file}: ${e}`);
            }
        }
        toast.success("Import complete");
    }, []);

    return {
        handleAddNode,
        handleDeleteSelection,
        onNodesDelete,
        handleNodeResizeCommit,
        onNodeDragStart,
        onNodeDragStop,
        onConnect,
        onEdgesDelete,
        onLayout,
        handleImportFiles,
        handleCopy, // New
        handlePaste // New
    };
}