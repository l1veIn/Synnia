import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, Node, OnSelectionChangeParams, ReactFlowProvider, useReactFlow, Edge as FlowEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { AssetNode as RustAssetNode, Edge as RustEdge, AgentDefinition } from '@/types/synnia';
import AssetNode, { AssetNodeData } from '@/components/nodes/AssetNode';
import { InspectorPanel } from '@/components/canvas/InspectorPanel';
import { CanvasContextMenu } from '@/components/canvas/CanvasContextMenu';
import { AgentRunDialog } from '@/components/agent/AgentRunDialog';
import { RemoveBgDialog } from '@/components/canvas/RemoveBgDialog';
import { toast } from 'sonner';
import { Loader2, Check, Trash2 } from 'lucide-react';
import { useTheme } from "next-themes";
import { useNavigate } from 'react-router-dom';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useCanvasSync } from '@/hooks/useCanvasSync';
import { useGraphOperations } from '@/hooks/useGraphOperations';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SYSTEM_AGENTS } from '@/lib/systemAgents';

interface AssetNodeWithData extends Omit<RustAssetNode, 'current_version_id'> {
    payload: string | null;
}

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { theme } = useTheme();
  const [projectPath, setProjectPath] = useState<string>("");
  const projectPathRef = useRef(""); 
  const navigate = useNavigate(); 
  
  const [lastMousePos, setLastMousePos] = useState<{x: number, y: number} | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('hand');

  // --- Custom Hooks ---
  const { record, undo, redo, canUndo, canRedo } = useUndoRedo();
  const { syncStatus, setSyncStatus, wrapSync } = useCanvasSync();
  
  const graphOps = useGraphOperations({
      nodes, setNodes, edges, setEdges, record, wrapSync, setSyncStatus
  });

  // --- Effects & Helpers ---

  useEffect(() => {
      projectPathRef.current = projectPath;
  }, [projectPath]);

  const handleManualSave = useCallback(() => {
      toast.success("Project Synced & Saved", { icon: <Check className="w-4 h-4 text-green-500" /> });
      refreshGraph(projectPathRef.current);
  }, []);

  useKeyboardShortcuts({
      handleManualSave, 
      setNodes, 
      setToolMode, 
      fitView, 
      undo, 
      redo,
      onDelete: () => graphOps.handleDeleteSelection(null, setSelectedNodeId),
      onCopy: graphOps.handleCopy,
      onPaste: graphOps.handlePaste
  });

  // --- Dialog States ---
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [removeBgDialogOpen, setRemoveBgDialogOpen] = useState(false);

  const nodeTypes = useMemo(() => ({ Asset: AssetNode }), []);
  
  // --- Data Loading ---

  const refreshGraph = useCallback(async (currentPath?: string) => {
    try {
      let pPath = currentPath || projectPathRef.current; 
      if (!pPath) {
           try { 
               pPath = await invoke<string>('get_current_project_path'); 
               if (pPath) setProjectPath(pPath);
           } catch {}
      }

      const assets = await invoke<AssetNodeWithData[]>('get_nodes');
      
      const flowNodes: Node<AssetNodeData>[] = assets.map(asset => ({
        id: asset.id,
        position: { x: asset.x, y: asset.y },
        type: 'Asset',
        style: (asset.width && asset.height) ? { width: asset.width, height: asset.height } : undefined,
        data: { 
          label: asset.label || asset.id.slice(0, 4),
          type: asset.type_ as AssetNodeData['type'],
          status: asset.status as AssetNodeData['status'],
          preview: asset.payload || undefined,
          projectPath: pPath,
          onResizeCommit: graphOps.handleNodeResizeCommit
        }, 
      }));
      setNodes(flowNodes);

      const rustEdges = await invoke<RustEdge[]>('get_edges');
      const flowEdges: FlowEdge[] = rustEdges.map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        animated: !e.recipe, 
        style: { stroke: e.recipe ? '#10b981' : '#64748b' },
        type: 'default'
      }));
      setEdges(flowEdges);

    } catch (e) {
        console.error("Failed to fetch graph", e);
    }
  }, [setNodes, setEdges, graphOps.handleNodeResizeCommit]);

  useEffect(() => {
    const init = async () => {
      try {
        const currentProjectPath = await invoke<string>('get_current_project_path');
        if (currentProjectPath) {
            setProjectPath(currentProjectPath);
            const name = currentProjectPath.split(/[\\/]/).pop() || "Untitled";
            await emit('project:active', { name });
            
            // Load Agents (System + DB)
            const dbAgents = await invoke<AgentDefinition[]>('get_agents');
            const uniqueDbAgents = dbAgents.filter(da => !SYSTEM_AGENTS.find(sa => sa.id === da.id));
            setAgents([...SYSTEM_AGENTS, ...uniqueDbAgents]);
            
            await refreshGraph(currentProjectPath);
        } else {
            toast.error("No project loaded. Redirecting to Dashboard.");
            navigate('/');
        }
      } catch (e) {
        console.error(e);
        navigate('/'); 
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate, refreshGraph]); 

  useEffect(() => {
      const unlistenDrop = listen<string[]>('tauri://file-drop', async (ev) => graphOps.handleImportFiles(ev.payload));
      const unlistenUpdate = listen('graph:updated', async () => refreshGraph(projectPathRef.current));
      return () => { unlistenDrop.then(f => f()); unlistenUpdate.then(f => f()); };
  }, [refreshGraph, graphOps.handleImportFiles]);

  const handleImportClick = async () => {
      try {
          const selected = await open({
              multiple: true,
              filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }]
          });
          if (selected) {
              const files = Array.isArray(selected) ? selected : [selected];
              // @ts-ignore
              await graphOps.handleImportFiles(files);
          }
      } catch (e) { console.error(e); }
  };

  // --- Agent Logic ---
  const handleRunAgent = async (agentId: string, inputs: any) => {
      if (!selectedAgent) return;
      try {
          toast.info(`Running ${selectedAgent.name}...`);
          const result = await invoke('run_agent', {
              agentDef: selectedAgent, // Pass full definition
              inputs,
              contextNodeId: selectedNodeId
          });
          
          toast.success("Agent task completed!");
          console.log("Agent output:", result);
          // Refresh graph to show new nodes
          await refreshGraph(projectPathRef.current);
      } catch (e) {
          toast.error(`Agent failed: ${e}`);
          throw e; 
      }
  };

  const handleSaveBgRemoval = async (blob: Blob) => {
      if (!selectedNodeId) return;
      try {
          toast.info("Saving processed image...");
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const byteArr = Array.from(bytes);
          await invoke('save_processed_image', { nodeId: selectedNodeId, imageData: byteArr });
          toast.success("Background removed & saved!");
      } catch (e) { toast.error(`Failed to save image: ${e}`); }
  };

  const handleSetCover = async () => {
      if (!selectedNodeId) return;
      try {
          await invoke('set_thumbnail', { nodeId: selectedNodeId });
          toast.success("Project cover updated!", { icon: <Check className="w-4 h-4" /> });
      } catch (e) { 
          toast.error(`Failed to set cover: ${e}`); 
      }
  };

  // --- Selection Logic ---
  const onSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
     setSelectedNodeId(selectedNodes.length > 0 ? selectedNodes[0].id : null);
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedCount = useMemo(() => nodes.filter(n => n.selected).length, [nodes]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
      setLastMousePos(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [screenToFlowPosition]);

  const handleResetProject = async () => {
      if (!confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;
      try {
          await invoke('reset_project');
          toast.success("Project Reset");
          const loadedAgents = await invoke<AgentDefinition[]>('get_agents');
          setAgents(loadedAgents);
      } catch (e) { toast.error(`Failed to reset: ${e}`); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  const isDark = theme === 'dark' || theme === 'system';

  return (
    <div className="h-full w-full flex flex-col relative">
       <AgentRunDialog 
          agent={selectedAgent} 
          open={agentDialogOpen} 
          onOpenChange={setAgentDialogOpen}
          onRun={handleRunAgent}
      />

      <RemoveBgDialog 
          open={removeBgDialogOpen}
          onOpenChange={setRemoveBgDialogOpen}
          nodeId={selectedNodeId || ""}
          imagePath={selectedNode?.data.preview as string || ""}
          projectPath={projectPath}
          onSave={handleSaveBgRemoval}
      />

      <CanvasToolbar 
          activeTool={toolMode}
          syncStatus={syncStatus}
          onToolChange={setToolMode}
          onAddNode={graphOps.handleAddNode} 
          onImportImage={handleImportClick} 
          onLayout={() => graphOps.onLayout('TB')} 
          onFitView={() => fitView({ duration: 400, padding: 0.2 })}
          onSave={handleManualSave}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
      />
      
      <div className="flex-1 w-full h-full bg-secondary/10 relative">
        <CanvasContextMenu
            selectionCount={selectedNode ? 1 : 0}
            selectedNodeType={selectedNode?.data.type}
            agents={agents}
            onAddNode={graphOps.handleAddNode}
            onImportImage={handleImportClick}
            onDelete={() => graphOps.handleDeleteSelection(null, setSelectedNodeId)}
            onCallAgent={(agent) => { setSelectedAgent(agent); setAgentDialogOpen(true); }}
            onRemoveBackground={() => setRemoveBgDialogOpen(true)}
            onSetCover={handleSetCover}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onSelectionChange={onSelectionChange}
                onConnect={graphOps.onConnect}
                onNodeDragStart={graphOps.onNodeDragStart}
                onNodeDragStop={graphOps.onNodeDragStop}
                onPaneContextMenu={onPaneContextMenu} 
                onNodesDelete={graphOps.onNodesDelete}
                onEdgesDelete={graphOps.onEdgesDelete}
                nodeTypes={nodeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
                selectionOnDrag={toolMode === 'select'}
                panOnDrag={toolMode === 'hand' ? true : [1, 2]}
                panOnScroll={false}
                zoomOnScroll={true}
                selectionMode={toolMode === 'select' ? undefined : undefined}
            >
            <Background color={isDark ? "#555" : "#ddd"} gap={16} />
            <Controls className="m-4 bg-card border border-border shadow-sm rounded-md" />
            <MiniMap 
                className="border border-border rounded-lg overflow-hidden !pointer-events-auto z-[50]"
                nodeColor={isDark ? "#333" : "#eee"} 
                maskColor={isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.6)"}
                style={{ backgroundColor: isDark ? "#1a1a1a" : "#fff" }}
                position="bottom-left"
            />
            </ReactFlow>
        </CanvasContextMenu>

        <InspectorPanel 
            node={selectedNode as Node<AssetNodeData> | null} 
            selectedCount={selectedCount}
            onClose={() => { setSelectedNodeId(null); setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))); }}
            onRefreshGraph={() => refreshGraph(projectPath)}
            onDelete={async (id) => graphOps.handleDeleteSelection(id, setSelectedNodeId)}
        />
      </div>
    </div>
  );
}

export default function CanvasPage() {
    return (
        <ReactFlowProvider>
            <CanvasContent />
        </ReactFlowProvider>
    );
}