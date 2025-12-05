import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { NodeType } from '@/types/project';

export function useFileUploadDrag() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useWorkflowStore((state) => state.addNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // 检查是否有文件
      if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      
      // 将屏幕坐标转换为 React Flow 坐标
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 简单的级联偏移，防止重叠
      let offset = 0;

      files.forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts');

        // 目前只处理图片和文本，作为 AssetNode
        if (isImage || isText) {
          const nodeId = addNode(NodeType.ASSET, {
            x: position.x + offset,
            y: position.y + offset,
          });

          if (isImage) {
            const imageUrl = URL.createObjectURL(file);
            updateNodeData(nodeId, { 
              title: file.name,
              assetType: 'image', 
              content: imageUrl 
            });
          } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
              updateNodeData(nodeId, { 
                title: file.name,
                assetType: 'text', 
                content: e.target?.result as string 
              });
            };
            reader.readAsText(file);
          }
          
          offset += 30; 
        }
      });
    },
    [addNode, updateNodeData, screenToFlowPosition]
  );

  return { onDragOver, onDrop };
}
