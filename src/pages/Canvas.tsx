import { ReactFlow, Background, Controls, Panel, MiniMap, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/store/workflowStore';
import { AssetNode } from '@/components/workflow/nodes/AssetNode';
import { GroupNode } from '@/components/workflow/nodes/GroupNode';
import { NodeType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Plus, Save, Box } from 'lucide-react';
import { useFileUploadDrag } from '@/hooks/useFileUploadDrag';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { EditorContextMenu } from '@/components/workflow/EditorContextMenu';
import { InspectorPanel } from '@/components/workflow/InspectorPanel';
import DeletableEdge from '@/components/workflow/edges/DeletableEdge';
import { useCanvasLogic } from '@/hooks/useCanvasLogic';
import { saveProjectToFile } from '@/lib/projectUtils';

// 注册节点类型
const nodeTypes = {
  [NodeType.ASSET]: AssetNode,
  [NodeType.GROUP]: GroupNode,
  // 临时使用 AssetNode 渲染其他类型，防止报错，后续替换
  [NodeType.RECIPE]: AssetNode, 
  [NodeType.NOTE]: AssetNode,
  [NodeType.COLLECTION]: AssetNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

function CanvasFlow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDrag,
  } = useWorkflowStore();

  // 启用 Hooks
  useAutoSave();
  useGlobalShortcuts();
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

  const handleSave = () => saveProjectToFile(nodes, edges);

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
                 <span className="text-xs font-bold text-muted-foreground px-2">ADD NODE</span>
                 
                 <Button size="sm" variant="secondary" onClick={() => handleAddNode(NodeType.ASSET)}>
                   <Plus className="w-3 h-3 mr-1" /> Asset
                 </Button>
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.RECIPE)}>
                   Recipe
                 </Button>
                 
                 <Button size="sm" variant="ghost" onClick={() => handleAddNode(NodeType.GROUP)}>
                   <Box className="w-3 h-3 mr-1" /> Group
                 </Button>
                 
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
