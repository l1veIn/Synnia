import { ReactFlow, Background, Controls, Panel, MiniMap, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useEffect } from 'react';

import { useWorkflowStore } from '@/store/workflowStore';
import { AssetNode } from '@/components/workflow/nodes/AssetNode';
import { GroupNode } from '@/components/workflow/nodes/GroupNode';
import { RackNode } from '@/components/workflow/nodes/RackNode';
import { NodeType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Plus, Save, Box, Home } from 'lucide-react';
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
      const hydrate = async () => {
          try {
              // 1. Try to get active project from Rust
              // In Mock mode, this returns null or empty unless we mock it to return a path
              const path = await apiClient.invoke<string>('get_current_project_path');
              
              if (path) {
                  console.log("[Hydration] Loading active project:", path);
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
  const nodeTypes = useMemo(() => ({
    [NodeType.ASSET]: AssetNode,
    [NodeType.GROUP]: GroupNode,
    [NodeType.RACK]: RackNode,
    [NodeType.RECIPE]: AssetNode, 
    [NodeType.NOTE]: AssetNode,
    [NodeType.COLLECTION]: AssetNode,
  }), []);

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
    handleAddNode
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
            nodeTypes={nodeTypes}
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
                   <Plus className="w-3 h-3 mr-1" /> Asset
                 </Button>
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.RECIPE)}>
                   Recipe
                 </Button>
                 
                 {/* <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.GROUP)}>
                   <Box className="w-3 h-3 mr-1" /> Group
                 </Button> */}
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.NOTE)}>
                   Note
                 </Button>

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
