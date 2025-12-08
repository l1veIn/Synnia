import { ReactFlow, Background, Controls, Panel, MiniMap, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useEffect } from 'react';

import { useWorkflowStore } from '@/store/workflowStore';
import { nodeTypes } from '@/components/workflow/nodes';
import { NodeType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Plus, Save, Box, Home, Image as ImageIcon, FileText } from 'lucide-react';
import { useFileUploadDrag } from '@/hooks/useFileUploadDrag';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { EditorContextMenu } from '@/components/workflow/EditorContextMenu';
import { InspectorPanel } from '@/components/workflow/InspectorPanel';
import DeletableEdge from '@/components/workflow/edges/DeletableEdge';
import { useCanvasLogic } from '@/hooks/useCanvasLogic';
import { saveProjectToFile } from '@/lib/projectUtils';
import { SynniaProject } from '@/bindings/synnia';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { dirname } from '@tauri-apps/api/path';

const STORAGE_KEY = 'synnia-workflow-autosave-v1';

function CanvasFlow() {
  const navigate = useNavigate();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDrag,
    loadProject,
    restoreDraft
  } = useWorkflowStore();

  // Hydration Logic
  useEffect(() => {
      // Hydrate from backend if there's an active project
      const hydrate = async () => {
          // 1. Get Server Port (Critical for Assets)
          try {
              const port = await apiClient.invoke<number>('get_server_port');
              console.log("[System] Local Asset Server port:", port);
              useWorkflowStore.getState().setServerPort(port);
          } catch (e) {
              console.warn("Failed to get server port (Assets may not load)", e);
          }

          // 2. Get Project Path
          try {
              const path = await apiClient.invoke<string>('get_current_project_path');
              const isTauri = !!(window as any).__TAURI_INTERNALS__;
              
              if (path) {
                  console.log("[Hydration] Loading active project path:", path);
                  try {
                      // Fix: If path is a file, get dirname. If it's a directory, use it as is.
                      let root = path;
                      if (path.toLowerCase().endsWith('.json') || path.toLowerCase().endsWith('.synnia')) {
                          root = await dirname(path);
                      }
                      console.log("[Hydration] Resolved Project Root:", root);
                      useWorkflowStore.getState().setProjectRoot(root);
                  } catch (e) { console.warn("Failed to resolve project root", e); }
                  
                  const project = await apiClient.invoke<SynniaProject>('load_project', { path });
                  loadProject(project);
              } else {
                  // 2. Fallback to LocalStorage (Draft)
                  // console.log("[Hydration] No active project. Checking localStorage...");
                  const saved = localStorage.getItem(STORAGE_KEY);
                  if (saved) {
                      try {
                          const parsed = JSON.parse(saved);
                          if (Array.isArray(parsed.nodes)) {
                              restoreDraft(parsed.nodes, parsed.edges || [], parsed.assets || {});
                          }
                      } catch(e) { console.error("Draft parse error", e); }
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
                  } catch(e) { console.error("Draft parse error", e); }
              }
          }
      };
      
      hydrate();
  }, []);

  // Memoize nodeTypes and edgeTypes to prevent unnecessary re-renders/warnings
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  const edgeTypes = useMemo(() => ({
    deletable: DeletableEdge,
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
      const { nodes, edges, assets, projectMeta, viewport } = useWorkflowStore.getState();
      
      if (projectMeta) {
          try {
              const project: SynniaProject = {
                  version: "2.0.0",
                  meta: projectMeta,
                  viewport,
                  graph: { nodes: nodes as any, edges: edges as any },
                  assets,
                  settings: {}
              };
              await apiClient.invoke('save_project', { project });
              toast.success("Project saved");
          } catch(e) {
              toast.error("Save failed: " + String(e));
              console.error(e);
          }
      } else {
          saveProjectToFile(nodes, edges);
      }
  };

  useGlobalShortcuts(handleSave);

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden">
      <div 
        className="relative h-full w-full"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <EditorContextMenu>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeDrag={onNodeDrag}
            nodeTypes={memoizedNodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'deletable', animated: true }}
            deleteKeyCode={null} // 禁用默认删除，交给 useGlobalShortcuts 处理级联删除
            fitView
            className="bg-dot-pattern"
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
          >
            <Background gap={20} color="#888" className="opacity-20" />
            <Controls />
            <MiniMap className="border bg-card" />
            
            {/* 临时工具栏 */}
            <Panel position="top-center" className="m-4">
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur p-2 rounded-lg border shadow-lg">
                 <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate('/')}>
                    <Home className="w-4 h-4" />
                 </Button>
                 
                 <div className="w-px h-4 bg-border mx-1" />
                 
                 <span className="text-xs font-bold text-muted-foreground px-2">ADD NODE</span>
                 
                 <Button size="sm" variant="secondary" onClick={() => handleAddNode(NodeType.ASSET)}>
                   <FileText className="w-3 h-3 mr-1" /> Text
                 </Button>
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddImage()}>
                   <ImageIcon className="w-3 h-3 mr-1" /> Image
                 </Button>
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.RECIPE)}>
                   Recipe
                 </Button>
                 
                 {/* <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.GROUP)}>
                   <Box className="w-3 h-3 mr-1" /> Group
                 </Button> */}
                 
                 {/* <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.NOTE)}>
                   Note
                 </Button> */}

                 <div className="w-px h-4 bg-border mx-1" />
                 
                 <Button size="sm" variant="outline" title="Save (JSON)" onClick={handleSave}>
                   <Save className="w-4 h-4" />
                 </Button>
              </div>
            </Panel>
          </ReactFlow>
        </EditorContextMenu>
        <InspectorPanel />
      </div>
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
