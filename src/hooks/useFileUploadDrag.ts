import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { graphEngine } from '@core/engine/GraphEngine';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

export function useFileUploadDrag() {
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
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

      for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts');

        if (isImage) {
          const toastId = toast.loading(`Importing ${file.name}...`);

          try {
            // Read file as base64
            const base64 = await readFileAsBase64(file);

            // Save via backend
            const result = await apiClient.saveProcessedImage(base64);

            graphEngine.mutator.createSmart({
              value: { src: result.relativePath, width: result.width, height: result.height },
              node: 'image',
              name: file.name,
              position: { x: position.x + offset, y: position.y + offset },
              config: {
                meta: {
                  width: result.width,
                  height: result.height,
                  preview: result.thumbnailPath || undefined
                }
              }
            });

            toast.success(`Imported ${file.name}`, { id: toastId });
          } catch (err) {
            console.error('Failed to import image:', err);
            toast.error(`Failed to import ${file.name}`, { id: toastId });
          }

          offset += 30;
        } else if (isText) {
          // Create text node first, then update with content after file read
          const nodeId = graphEngine.mutator.createSmart({
            value: { content: '', format: 'plain' },
            node: 'text',
            name: file.name,
            position: { x: position.x + offset, y: position.y + offset },
          });

          const reader = new FileReader();
          reader.onload = (e) => {
            graphEngine.assets.update(
              graphEngine.state.nodes.find(n => n.id === nodeId)?.data.assetId as string,
              { content: e.target?.result as string, format: 'plain' }
            );
          };
          reader.readAsText(file);

          offset += 30;
        }
      }
    },
    [screenToFlowPosition]
  );

  return { onDragOver, onDrop };
}

// Helper function to read file as base64
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

