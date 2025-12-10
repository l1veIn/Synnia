import { createStore, useStore } from 'zustand';
import { useWorkflowStore } from '@/store/workflowStore';

const fallbackTemporalStore = createStore(() => ({
  undo: () => {},
  redo: () => {},
  clear: () => {},
  pastStates: [] as unknown[],
  futureStates: [] as unknown[],
}));

export function useHistory() {
  // Pause/Resume logic relies on the custom actions in the main store
  // because Zundo v2 doesn't expose pause/resume directly on the temporal store instance in this way.
  const pause = useWorkflowStore((state) => state.pauseHistory);
  const resume = useWorkflowStore((state) => state.resumeHistory);
  
  // Access the temporal store injected by Zundo middleware (falls back to a noop store for safety)
  const temporalStore = (useWorkflowStore as unknown as { temporal?: any }).temporal ?? fallbackTemporalStore;
  const temporalState = useStore(temporalStore, (state: any) => state);

  if (temporalStore === fallbackTemporalStore) {
    console.warn('Zundo middleware is not initialized properly.');
  }
  
  const { undo, redo, pastStates, futureStates, clear } = temporalState;

  return {
    undo,
    redo,
    canUndo: (pastStates?.length ?? 0) > 0,
    canRedo: (futureStates?.length ?? 0) > 0,
    clear,
    historyLength: pastStates?.length ?? 0,
    pause,
    resume,
  };
}
