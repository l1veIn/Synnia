import { ReactFlow, Background, Panel, MiniMap, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useEffect, useState } from 'react';

import { useWorkflowStore } from '@/store/workflowStore';
import { getNodeTypes, ensureRecipeNodesRegistered } from '@/components/workflow/nodes';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Save, Home, FolderOpen } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useFileUploadDrag } from '@/hooks/useFileUploadDrag';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { EditorContextMenu } from '@/components/workflow/EditorContextMenu';
import { InspectorPanel } from '@/components/workflow/InspectorPanel';
import DeletableEdge from '@/components/workflow/edges/DeletableEdge';
import OutputEdge from '@/components/workflow/edges/OutputEdge';
import { useCanvasLogic } from '@/hooks/useCanvasLogic';

import { SynniaProject } from '@/bindings';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { dirname } from '@tauri-apps/api/path';
import { graphEngine } from '@core/engine/GraphEngine';
import { AssetLibraryDialog } from '@/components/AssetLibraryDialog';
import { NodePicker } from '@/components/workflow/NodePicker';
import { AssistantModal } from '@/components/assistant-ui/assistant-modal';
import { AssistantFullscreen } from '@/components/assistant-ui/assistant-fullscreen';
import { ChatProvider } from '@/features/chat';
const STORAGE_KEY = 'synnia-workflow-autosave-v1';

function CanvasFlow() {
  const navigate = useNavigate();
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true); // Block render until hydration complete
  const nodes = useWorkflowStore(s => s.nodes);
  const edges = useWorkflowStore(s => s.edges);
  const viewport = useWorkflowStore(s => s.viewport);
  const setViewport = useWorkflowStore(s => s.setViewport);
  const loadProject = useWorkflowStore(s => s.loadProject);
  const restoreDraft = useWorkflowStore(s => s.restoreDraft);

  const reactFlowInstance = useReactFlow();

  // Hydration Logic
  useEffect(() => {
    // Hydrate from backend if there's an active project
    const hydrate = async () => {
      // 1. Get Server Port (Critical for Assets)
      try {
        const port = await apiClient.invoke<number>('get_server_port');
        useWorkflowStore.getState().setServerPort(port);
      } catch (e) {
        console.warn("Failed to get server port (Assets may not load)", e);
      }

      // 2. Get Project Path
      try {
        const path = await apiClient.invoke<string>('get_current_project_path');
        const isTauri = !!(window as any).__TAURI_INTERNALS__;

        if (path) {
          try {
            // Fix: If path is a file, get dirname. If it's a directory, use it as is.
            let root = path;
            if (path.toLowerCase().endsWith('.json') || path.toLowerCase().endsWith('.synnia')) {
              root = await dirname(path);
            }
            useWorkflowStore.getState().setProjectRoot(root);
          } catch (e) { console.warn("Failed to resolve project root", e); }

          const project = await apiClient.invoke<SynniaProject>('load_project', { path });

          // Pre-register recipe nodes used in this project before loading
          const recipeNodeTypes = project.graph?.nodes
            ?.filter(n => n.type?.startsWith('recipe:'))
            ?.map(n => n.type!.slice(7)) || [];

          if (recipeNodeTypes.length > 0) {
            console.log('[Canvas] Pre-registering recipes:', recipeNodeTypes);
            await ensureRecipeNodesRegistered(recipeNodeTypes);
          }

          loadProject(project);

          // Restore viewport after a short delay to ensure ReactFlow is ready
          setTimeout(() => {
            const savedViewport = useWorkflowStore.getState().viewport;
            if (savedViewport && (savedViewport.x !== 0 || savedViewport.y !== 0 || savedViewport.zoom !== 1)) {
              reactFlowInstance.setViewport(savedViewport);
            }
          }, 100);
        } else {
          // 2. Fallback to LocalStorage (Draft)
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed.nodes)) {
                restoreDraft(parsed.nodes, parsed.edges || [], parsed.assets || {});
              }
            } catch (e) { console.error("Draft parse error", e); }
          }
        }
      } catch (e) {
        // console.warn("[Hydration] Backend check failed (normal in browser):", e);
        // Fallback to Draft
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.nodes)) {
              restoreDraft(parsed.nodes, parsed.edges || [], parsed.assets || {});
            }
          } catch (e) { console.error("Draft parse error", e); }
        }
      }
    };

    hydrate().finally(() => setIsHydrating(false));
  }, []);

  // Dynamic nodeTypes - memoized but updates when nodes change (indicating new recipe may have been registered)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedNodeTypes = useMemo(() => getNodeTypes(), [nodes.length]);

  const edgeTypes = useMemo(() => ({
    deletable: DeletableEdge,
    output: OutputEdge,
  }), []);

  // 启用 Hooks
  useAutoSave();
  const { onDragOver, onDrop } = useFileUploadDrag();

  // 提取的逻辑 Hook
  const {
    handleNodeDragStart,
    handleNodeDragStop,
    onNodeDoubleClick,
    onNodeContextMenu,
    onPaneContextMenu,
    handleAddNode,
    handleAddImage
  } = useCanvasLogic();

  const handleSave = async () => {
    const { nodes, edges, projectMeta, viewport } = useWorkflowStore.getState();

    if (!projectMeta) {
      toast.warning("No project open. Use File > New Project first.");
      return;
    }

    try {
      // Assets are synced in real-time via AssetSystem, so we pass empty here.
      // Manual save is essentially a "comfort button" - auto-save already handles persistence.
      const project: SynniaProject = {
        version: "2.0.0",
        meta: projectMeta,
        viewport,
        graph: { nodes: nodes as any, edges: edges as any },
        assets: {},  // Empty - assets managed by AssetSystem
        settings: {}
      };
      await apiClient.invoke('save_project', { project });
      toast.success("Project saved");
    } catch (e) {
      toast.error("Save failed: " + String(e));
      console.error(e);
    }
  };

  useGlobalShortcuts(handleSave);

  // Show loading during hydration
  if (isHydrating) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading project...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden">
      <div
        className="relative h-full w-full"
      >
        <EditorContextMenu>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={graphEngine.interaction.onNodesChange}
            onEdgesChange={graphEngine.interaction.onEdgesChange}
            onConnect={graphEngine.interaction.onConnect}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeDrag={graphEngine.interaction.onNodeDrag}
            nodeTypes={memoizedNodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'deletable' }}
            deleteKeyCode={null} // 禁用默认删除，交给 useGlobalShortcuts 处理级联删除
            defaultViewport={viewport}
            className="bg-dot-pattern"
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onMoveEnd={(event, viewport) => setViewport(viewport)}
          >
            <Background gap={20} color="#888" className="opacity-20" />
            {/* <Controls /> */}
            <MiniMap className="border bg-card" />

            {/* Canvas Toolbar */}
            <Panel position="top-center" className="m-4">
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur p-2 rounded-lg border shadow-lg">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate('/')}>
                  <Home className="w-4 h-4" />
                </Button>

                <div className="w-px h-4 bg-border mx-1" />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <Plus className="w-4 h-4 mr-1" /> Add Node
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <NodePicker
                      onSelect={(item) => {
                        if (item.action === 'import-file') {
                          // File import action (Image, PDF, Video, etc.)
                          // For now handleAddImage handles image import
                          handleAddImage();
                        } else if (item.recipeId) {
                          graphEngine.mutator.createSmart({ value: {}, node: `recipe:${item.recipeId}`, position: { x: 150, y: 150 } });
                        } else if (item.nodeType) {
                          handleAddNode(item.nodeType);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <div className="w-px h-4 bg-border mx-1" />

                <Button size="sm" variant="outline" title="Save (Cmd+S)" onClick={handleSave}>
                  <Save className="w-4 h-4" />
                </Button>

                <div className="w-px h-4 bg-border mx-1" />

                <Button size="sm" variant="ghost" onClick={() => setAssetLibraryOpen(true)} title="Asset Library">
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        </EditorContextMenu>
        <InspectorPanel />
        <AssetLibraryDialog
          open={assetLibraryOpen}
          onOpenChange={setAssetLibraryOpen}
          onLocateNode={(nodeId) => {
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
              // Select the node using onNodesChange
              graphEngine.interaction.onNodesChange([
                // First deselect all
                ...nodes.filter(n => n.selected).map(n => ({
                  type: 'select' as const,
                  id: n.id,
                  selected: false
                })),
                // Then select target
                {
                  type: 'select' as const,
                  id: nodeId,
                  selected: true
                }
              ]);

            }
          }}
        />
      </div>
      <TooltipProvider>
        <ChatProvider>
          {!isFullscreen && (
            <AssistantModal
              isOpen={isModalOpen}
              onOpenChange={setIsModalOpen}
              onExpand={() => {
                setIsModalOpen(false);
                setIsFullscreen(true);
              }}
            />
          )}
          <AssistantFullscreen
            isOpen={isFullscreen}
            onClose={() => {
              setIsFullscreen(false);
              setIsModalOpen(true);
            }}
          />
        </ChatProvider>
      </TooltipProvider>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}
