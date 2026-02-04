import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { graphEngine } from '@core/engine/GraphEngine';
import { useCanvasLogic } from './useCanvasLogic';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { importHeavyNodeWithToast } from '@/lib/importHeavyNode';
import { resolveNodeAssetId } from '@core/utils/nodeAsset';

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

// Module-level flag to prevent duplicate listener registration across component remounts
// This is necessary because React Strict Mode mounts/unmounts/remounts components
let globalListenerSetup = false;
let globalUnlisten: UnlistenFn | undefined;

export function useFileUploadDrag() {
  const { screenToFlowPosition } = useReactFlow();
  const { handleAddImage } = useCanvasLogic();

  // Use refs to access latest values in event callback without re-registering listener
  const screenToFlowPositionRef = useRef(screenToFlowPosition);
  screenToFlowPositionRef.current = screenToFlowPosition;

  // Tauri drag-drop event handler
  useEffect(() => {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    if (!isTauri) return;

    // Prevent duplicate listener registration (module-level check)
    if (globalListenerSetup) return;
    globalListenerSetup = true;

    const setupListener = async () => {
      globalUnlisten = await listen<DragDropPayload>('tauri://drag-drop', async (event) => {
        console.log('[Tauri] drag-drop event:', event.payload);

        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;

        // Use viewport center as default position for dropped files
        const centerPosition = screenToFlowPositionRef.current({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });

        let offset = 0;

        for (const filePath of paths) {
          const ext = filePath.split('.').pop()?.toLowerCase() || '';
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);

          if (isImage) {
            // Use unified import with toast
            await importHeavyNodeWithToast(filePath, {
              position: { x: centerPosition.x + offset, y: centerPosition.y + offset },
            });
            offset += 30;
          }
          // TODO: Add audio/video support using importHeavyNode
        }
      });
    };

    setupListener();

    // Cleanup: only unregister if this is a real unmount (not Strict Mode remount)
    return () => {
      // In development with Strict Mode, this cleanup will run between mount cycles
      // We intentionally don't call globalUnlisten here to keep the listener active
    };
  }, []); // Empty deps - only run once on mount

  // Keep HTML5 drag handlers for browser-only mode (web fallback)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      // Only handle in browser mode (Tauri uses its own event system)
      const isTauri = !!(window as any).__TAURI_INTERNALS__;
      if (isTauri) {
        console.log('[Browser] Ignoring HTML drop in Tauri mode');
        return;
      }

      console.log('[Browser] onDrop triggered');

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
          await handleAddImage(
            { x: position.x + offset, y: position.y + offset },
            file
          );
          offset += 30;
        } else if (isText) {
          const nodeId = graphEngine.mutator.createSmart({
            value: { content: '', format: 'plain' },
            node: 'text',
            name: file.name,
            position: { x: position.x + offset, y: position.y + offset },
          });

          const reader = new FileReader();
          reader.onload = (e) => {
            const node = graphEngine.state.nodes.find(n => n.id === nodeId);
            const assetId = resolveNodeAssetId(node);
            if (assetId) {
              graphEngine.assets.update(assetId, { content: e.target?.result as string, format: 'plain' });
            }
          };
          reader.readAsText(file);

          offset += 30;
        }
      }
    },
    [screenToFlowPosition, handleAddImage]
  );

  return { onDragOver, onDrop };
}
