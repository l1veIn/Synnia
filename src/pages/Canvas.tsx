import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, OnSelectionChangeParams, ReactFlowProvider, useReactFlow, Node, OnConnectStartParams } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentDefinition } from '@/types/project';
import AssetNode, { UIAssetNodeData } from '@/components/nodes/AssetNode';
import { InspectorPanel } from '@/components/canvas/InspectorPanel';
import { AgentRunDialog } from '@/components/agent/AgentRunDialog';
import { RemoveBgDialog } from '@/components/canvas/RemoveBgDialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTheme } from "next-themes";
import { useNavigate } from 'react-router-dom';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SYSTEM_AGENTS } from '@/lib/systemAgents';
import { useProjectStore } from '@/store/projectStore';
import { useStore as useZustandStore } from 'zustand';

// New Menus
import { CustomMenu } from '@/components/ui/custom-menu';
import { PaneMenu } from '@/components/canvas/menus/PaneMenu';
import { NodeMenu } from '@/components/canvas/menus/NodeMenu';
import { SelectionMenu } from '@/components/canvas/menus/SelectionMenu';
import { RecipePickerMenu } from '@/components/canvas/menus/RecipePickerMenu';

// --- Types ---
type MenuState = 
  | { type: 'hidden' }
  | { type: 'pane', x: number, y: number }
  | { type: 'node', x: number, y: number, nodeId: string }
  | { type: 'selection', x: number, y: number }
  | { type: 'recipe-picker', x: number, y: number, sourceNodeId: string };

function CanvasContent() {
  // --- Store ---
  const { 
      nodes, edges, projectPath, isLoading,
      onNodesChange, onEdgesChange, onConnect, 
      loadProject, saveProject, addNode, updateNodeData, deleteNode,
      setNodes, runRecipe
  } = useProjectStore();

  const { undo, redo, pause, resume } = useZustandStore(useProjectStore.temporal, (state) => state);

  // --- Local State ---
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>({ type: 'hidden' });
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { theme } = useTheme();
  const navigate = useNavigate(); 
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('hand');
  
  // --- Connection State ---
  const connectionStartRef = useRef<OnConnectStartParams | null>(null);

  // --- Dialog States ---
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [removeBgDialogOpen, setRemoveBgDialogOpen] = useState(false);

  // Memoize nodeTypes
  const nodeTypes = useMemo(() => ({ Asset: AssetNode }), []);

  // --- Helpers ---
  const closeMenu = useCallback(() => setMenuState({ type: 'hidden' }), []);

  // --- Initialization ---
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const init = async () => {
        try {
            const currentProjectPath = await invoke<string>('get_current_project_path');
            if (currentProjectPath) {
                await loadProject(currentProjectPath);
                const dbAgents = await invoke<AgentDefinition[]>('get_agents');
                const uniqueDbAgents = dbAgents.filter(da => !SYSTEM_AGENTS.find(sa => sa.id === da.id));
                setAgents([...SYSTEM_AGENTS, ...uniqueDbAgents]);
            } else {
                toast.error("No project loaded. Redirecting to Dashboard.");
                navigate('/');
            }
        } catch (e) {
            console.error(e);
            navigate('/');
        }
    };
    init();
  }, [loadProject, navigate]);

  // --- Global Click Listener to Close Menu ---
  useEffect(() => {
      const handleClick = (e: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
              closeMenu();
          }
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
  }, [closeMenu]);

  // --- Event Listeners ---
  const handleImportFiles = useCallback(async (files: string[]) => {
      toast.info(`Importing ${files.length} file(s)...`);
      for (const file of files) {
          try {
              const relativePath = await invoke<string>('import_file', { filePath: file });
              const pos = { x: Math.random() * 400, y: Math.random() * 400 };
              addNode("Image", pos, relativePath);
          } catch (e) {
              toast.error(`Failed to import ${file}: ${e}`);
          }
      }
      toast.success("Import complete");
  }, [addNode]);

  useEffect(() => {
      const unlistenDrop = listen<string[]>('tauri://file-drop', async (ev) => handleImportFiles(ev.payload));
      return () => { unlistenDrop.then(f => f()); };
  }, [handleImportFiles]);

  // --- Handlers ---
  const handleImportClick = async () => {
      try {
          const selected = await open({
              multiple: true,
              filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }]
          });
          if (selected) {
              const files = Array.isArray(selected) ? selected : [selected];
              await handleImportFiles(files);
          }
      } catch (e) { console.error(e); }
  };

  const handleRunAgent = async (_agentId: string, inputs: any) => {
      if (!selectedAgent) return;
      try {
          toast.info(`Running ${selectedAgent.name}...`);
          // Mock Agent Run for now as per current backend state
          await invoke<any[]>('run_agent', {
              agentDef: selectedAgent, 
              inputs,
              contextNodeId: selectedNodeId
          });
          toast.success("Agent task completed!");
          // Handle results...
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
          
          const relativePath = await invoke<string>('save_processed_image', { nodeId: selectedNodeId, imageData: byteArr });
          
          updateNodeData(selectedNodeId, { 
              properties: { content: relativePath } 
          });
          toast.success("Background removed & saved!");
      } catch (e) { toast.error(`Failed to save image: ${e}`); }
  };

  const handleSetCover = async () => {
      if (!selectedNodeId) return;
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node && (node.data.assetType === 'image_asset' || node.data.assetType === 'Image')) {
          useProjectStore.setState(state => ({
              meta: { ...state.meta, thumbnail: node.data.properties.content as string }
          }));
          toast.success("Set as project cover (Save to persist)");
      } else {
          toast.error("Select an image node first");
      }
  };

  const handleNodeResizeCommit = useCallback(async (nodeId: string, _oldW: number, _oldH: number, newW: number, newH: number) => {
      useProjectStore.setState(state => ({
          nodes: state.nodes.map(n => 
              n.id === nodeId ? { ...n, width: newW, height: newH, style: { ...n.style, width: newW, height: newH } } : n
          )
      }));
  }, []);

  // --- Connection Handlers ---
  const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
      connectionStartRef.current = params;
  }, []);

  const onConnectEnd = useCallback((event: any) => {
      // Check if target is pane (not a handle or node)
      const targetIsPane = event.target.classList.contains('react-flow__pane');
      
      if (targetIsPane && connectionStartRef.current?.nodeId) {
          const { clientX, clientY } = event;
          setMenuState({ 
              type: 'recipe-picker', 
              x: clientX, 
              y: clientY, 
              sourceNodeId: connectionStartRef.current.nodeId 
          });
      }
      connectionStartRef.current = null;
  }, []);

  // --- Context Menu Handlers ---
  const onNodeDragStart = useCallback(() => {
      pause();
  }, [pause]);

  const onNodeDragStop = useCallback(() => {
      resume();
  }, [resume]);

  // Correctly typing the event to satisfy ReactFlow's expectation
  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setMenuState({ type: 'pane', x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const selected = nodes.filter(n => n.selected);
      if (selected.length > 1) {
          setMenuState({ type: 'selection', x: event.clientX, y: event.clientY });
      } else {
          if (!node.selected) {
              setNodes(nodes.map(n => ({ ...n, selected: n.id === node.id })));
          }
          setMenuState({ type: 'node', x: event.clientX, y: event.clientY, nodeId: node.id });
      }
  }, [nodes, setNodes]);

  // --- Shortcuts ---
  useKeyboardShortcuts({
      handleManualSave: saveProject,
      setNodes: (update) => {
          const currentNodes = useProjectStore.getState().nodes;
          const newNodes = update(currentNodes);
          setNodes(newNodes);
      },
      setToolMode,
      fitView,
      undo,
      redo,
      onDelete: () => selectedNodeId && deleteNode(selectedNodeId),
      onCopy: () => {}, 
      onPaste: () => {} 
  });

  // --- Selection ---
  const onSelectionChange = ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
     setSelectedNodeId(selectedNodes.length > 0 ? selectedNodes[0].id : null);
  };
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedCount = useMemo(() => nodes.filter(n => n.selected).length, [nodes]);

  const nodesWithHandler = useMemo(() => nodes.map(n => ({
      ...n,
      data: { ...n.data, onResizeCommit: handleNodeResizeCommit, projectPath }
  })), [nodes, handleNodeResizeCommit, projectPath]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
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
          imagePath={selectedNode?.data.properties?.content as string || ""}
          projectPath={projectPath || ""}
          onSave={handleSaveBgRemoval}
      />

      <CanvasToolbar 
          activeTool={toolMode}
          onToolChange={setToolMode}
          onAddNode={(type, initialData) => addNode(type, { x: Math.random() * 400, y: Math.random() * 400 }, initialData)} 
          onImportImage={handleImportClick} 
          onLayout={() => {}} 
          onFitView={() => fitView({ duration: 400, padding: 0.2 })}
      />
      
      <div className="flex-1 w-full h-full bg-secondary/10 relative" onContextMenu={(e) => e.preventDefault()}>
            <ReactFlow
                nodes={nodesWithHandler}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onSelectionChange={onSelectionChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
                
                // New Menu Handlers
                onPaneContextMenu={onPaneContextMenu}
                onNodeContextMenu={onNodeContextMenu}
                
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

            {/* --- Explicit Context Menus --- */}
            {menuState.type !== 'hidden' && (
                <CustomMenu 
                    ref={menuRef}
                    style={{ top: menuState.y, left: menuState.x }}
                >
                    {menuState.type === 'pane' && (
                        <PaneMenu 
                            onAddNode={(type, initialData) => addNode(type, screenToFlowPosition({ x: menuState.x, y: menuState.y }), initialData)}
                            onImportImage={handleImportClick}
                            onClose={closeMenu}
                        />
                    )}
                    
                    {menuState.type === 'node' && (() => {
                        const node = nodes.find(n => n.id === menuState.nodeId);
                        if (!node) return null;
                        return (
                            <NodeMenu 
                                node={{ id: node.id, data: node.data }}
                                agents={agents}
                                onRunRecipe={runRecipe}
                                onCallAgent={(agent) => { setSelectedAgent(agent); setAgentDialogOpen(true); }}
                                onRemoveBackground={() => setRemoveBgDialogOpen(true)}
                                onSetCover={handleSetCover}
                                onDelete={() => deleteNode(node.id)}
                                onClose={closeMenu}
                            />
                        );
                    })()}

                    {menuState.type === 'selection' && (
                        <SelectionMenu 
                            selectionCount={nodes.filter(n => n.selected).length}
                            agents={agents}
                            onCallAgent={(agent) => { setSelectedAgent(agent); setAgentDialogOpen(true); }}
                            onDelete={() => {
                                const selected = nodes.filter(n => n.selected).map(n => n.id);
                                selected.forEach(id => deleteNode(id));
                            }}
                            onClose={closeMenu}
                        />
                    )}

                    {menuState.type === 'recipe-picker' && (
                        <RecipePickerMenu 
                            sourceNodeId={menuState.sourceNodeId}
                            onRunRecipe={runRecipe}
                            onClose={closeMenu}
                        />
                    )}
                </CustomMenu>
            )}

        <InspectorPanel 
            node={selectedNode as Node<UIAssetNodeData>} 
            selectedCount={selectedCount}
            onClose={() => { setSelectedNodeId(null); setNodes(nodes.map((n) => ({ ...n, selected: false }))); }}
            onRefreshGraph={() => {}} 
            onDelete={async (id) => deleteNode(id)}
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