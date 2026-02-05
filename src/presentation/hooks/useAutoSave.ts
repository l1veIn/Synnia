import { useEffect, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { apiClient } from '@/lib/apiClient';
import { SynniaProject } from '@/bindings';

const STORAGE_KEY = 'synnia-workflow-autosave-v1';
const AUTOSAVE_INTERVAL = 1000; // 1 second debounce

export function useAutoSave() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  // Note: assets are NOT included - they are synced in real-time via AssetSystem

  const projectMeta = useWorkflowStore((state) => state.projectMeta);
  const viewport = useWorkflowStore((state) => state.viewport);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save on change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      if (projectMeta) {
        // --- Real Project Auto-Save (Shadow File) ---
        // Assets are synced in real-time, so we pass an empty object here.
        // The backend will preserve existing assets in the database.
        const project: SynniaProject = {
          version: "2.0.0",
          meta: projectMeta,
          viewport: viewport || { x: 0, y: 0, zoom: 1 },
          graph: {
            nodes: nodes as any,
            edges: edges as any
          },
          assets: {},  // Empty - assets are managed separately via AssetSystem
          settings: {}
        };

        try {
          await apiClient.invoke('save_project_autosave', { project });
        } catch (e) {
          console.error('[AutoSave] Failed:', e);
        }
      } else {
        // --- Draft Save (LocalStorage) ---
        // For drafts, we still save assets since there's no backend
        const assets = useWorkflowStore.getState().assets;
        const data = JSON.stringify({ nodes, edges, assets });
        localStorage.setItem(STORAGE_KEY, data);
      }
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [nodes, edges, projectMeta, viewport]);  // Removed 'assets' dependency
}