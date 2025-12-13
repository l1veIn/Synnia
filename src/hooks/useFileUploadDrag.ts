import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeType } from '@/types/project';
import { graphEngine } from '@/lib/engine/GraphEngine';

export function useFileUploadDrag() {
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(event.dataTransfer.files);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let offset = 0;

      files.forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts');

        if (isImage || isText) {
          const nodeId = graphEngine.mutator.addNode(NodeType.ASSET, {
            x: position.x + offset,
            y: position.y + offset,
          });

          if (isImage) {
            const imageUrl = URL.createObjectURL(file);
            graphEngine.updateNode(nodeId, {
              data: {
                title: file.name,
                assetType: 'image',
                content: imageUrl
              }
            });
          } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
              graphEngine.updateNode(nodeId, {
                data: {
                  title: file.name,
                  assetType: 'text',
                  content: e.target?.result as string
                }
              });
            };
            reader.readAsText(file);
          }

          offset += 30;
        }
      });
    },
    [screenToFlowPosition]
  );

  return { onDragOver, onDrop };
}
