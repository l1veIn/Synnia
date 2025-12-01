import { useEffect, useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, Node, OnSelectionChangeParams, OnConnect, addEdge, Connection, Edge as FlowEdge, NodeDragHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import { AssetNode as RustAssetNode, Edge as RustEdge } from '@/types/synnia';
import AssetNode, { AssetNodeData } from '@/components/nodes/AssetNode';
import { InspectorPanel } from '@/components/canvas/InspectorPanel';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { useTheme } from "next-themes";

export default function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { theme } = useTheme();

  // Memoize nodeTypes so React Flow doesn't re-render unnecessarily
  const nodeTypes = useMemo(() => ({
    Asset: AssetNode,
  }), []);

  // Initial Setup
  useEffect(() => {
    const init = async () => {
      try {
        const homeDir = "C:\\Users\\A\\Desktop\\synnia_demo_project"; 
        await invoke('init_project', { path: homeDir });
        await refreshGraph();
      } catch (e) {
        console.error(e);
        toast.error(`Failed to init project: ${e}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const refreshGraph = async () => {
    try {
      // Fetch Nodes
      const assets = await invoke<RustAssetNode[]>('get_nodes');
      const flowNodes: Node<AssetNodeData>[] = assets.map(asset => ({
        id: asset.id,
        position: { x: asset.x, y: asset.y },
        type: 'Asset',
        data: { 
          label: asset.id,
          type: asset.type_ as AssetNodeData['type'],
          status: asset.status as AssetNodeData['status'],
          preview: asset.type_ === 'Text' ? "This is a sample text content for this node..." : undefined
        }, 
      }));
      setNodes(flowNodes);

      // Fetch Edges
      const rustEdges = await invoke<RustEdge[]>('get_edges');
      const flowEdges: FlowEdge[] = rustEdges.map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        animated: !e.recipe, // Dashed (animated) for manual/weak links? Or stick to standard
        style: { stroke: e.recipe ? '#10b981' : '#64748b' }, // Green for solid, Slate for manual
        type: 'default'
      }));
      setEdges(flowEdges);

    } catch (e) {
        console.error("Failed to fetch graph", e);
    }
  };

  const handleAddNode = async (type: string) => {
    try {
      const x = Math.random() * 400;
      const y = Math.random() * 400;
      
      await invoke('create_node', { 
        projectId: "demo", 
        nodeType: type, 
        x, 
        y 
      });
      
      toast.success(`Created ${type} Node`);
      await refreshGraph();
    } catch (e) {
      toast.error(`Error: ${e}`);
    }
  };

  const handleResetProject = async () => {
      if (!confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;
      try {
          await invoke('reset_project');
          toast.success("Project Reset");
          await refreshGraph();
      } catch (e) {
          toast.error(`Failed to reset: ${e}`);
      }
  };

  const onConnect = useCallback(async (params: Connection) => {
    try {
        // Persist to DB
        if (params.source && params.target) {
            await invoke('create_edge', { 
                sourceId: params.source, 
                targetId: params.target 
            });
            
            // Optimistically update UI or refresh
            // setEdges((eds) => addEdge(params, eds)); 
            // Better to refresh to get the DB ID and styled edge
            await refreshGraph();
            toast.success("Linked!");
        }
    } catch (e) {
        toast.error(`Failed to link: ${e}`);
    }
  }, [setEdges]);

  // Persist node position on drag stop
  const onNodeDragStop: NodeDragHandler = useCallback(async (_event, node) => {
      try {
          await invoke('update_node_pos', {
              id: node.id,
              x: node.position.x,
              y: node.position.y
          });
      } catch (e) {
          console.error("Failed to update node position", e);
      }
  }, []);

  // Handle Selection
  const onSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
     if (selectedNodes.length > 0) {
         setSelectedNodeId(selectedNodes[0].id);
     } else {
         setSelectedNodeId(null);
     }
  };

  const selectedNode = useMemo(() => {
      return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  const isDark = theme === 'dark' || theme === 'system';

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Header */}
      <div className="h-12 border-b flex items-center px-4 gap-2 bg-background z-10">
        <span className="font-bold mr-4">Synnia Canvas</span>
        <Button size="sm" variant="secondary" onClick={() => handleAddNode("Text")}>+ Text</Button>
        <Button size="sm" variant="secondary" onClick={() => handleAddNode("Image")}>+ Image</Button>
        <Button size="sm" variant="secondary" onClick={() => handleAddNode("Prompt")}>+ Prompt</Button>
        
        <div className="flex-1" />
        <Button size="sm" variant="destructive" onClick={handleResetProject} className="ml-auto">
            <Trash2 className="w-4 h-4 mr-2" /> Reset DB
        </Button>
      </div>
      
      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full bg-secondary/10 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={isDark ? "#555" : "#ddd"} gap={16} />
          <Controls className="bg-background border-border" />
          <MiniMap 
            className="border border-border rounded-lg overflow-hidden"
            nodeColor={isDark ? "#333" : "#eee"} 
            maskColor={isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.6)"}
            style={{ backgroundColor: isDark ? "#1a1a1a" : "#fff" }}
          />
        </ReactFlow>

        {/* Inspector Panel (Floating Overlay) */}
        <InspectorPanel 
            node={selectedNode as Node<AssetNodeData> | null} 
            onClose={() => {
                setSelectedNodeId(null);
                setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            onRefreshGraph={refreshGraph} 
        />
      </div>
    </div>
  );
}
