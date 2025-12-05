import { useEffect, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const STORAGE_KEY = 'synnia-workflow-autosave-v1';
const AUTOSAVE_INTERVAL = 1000; // 1 second debounce

export function useAutoSave() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved);
        if (Array.isArray(savedNodes) && Array.isArray(savedEdges)) {
          console.log('Auto-loaded workflow from localStorage', savedNodes.length, 'nodes');
          setWorkflow(savedNodes, savedEdges);
        }
      } catch (e) {
        console.error('Failed to load autosave', e);
      }
    }
    isLoadedRef.current = true;
  }, [setWorkflow]);

  // Save on change
  useEffect(() => {
    if (!isLoadedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const data = JSON.stringify({ nodes, edges });
      localStorage.setItem(STORAGE_KEY, data);
      // console.log('Autosaved');
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [nodes, edges]);
}
