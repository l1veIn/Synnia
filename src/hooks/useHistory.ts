import { useStore } from 'zustand';
import { useWorkflowStore } from '@/store/workflowStore';

export function useHistory() {
  // Pause/Resume logic relies on the custom actions in the main store
  // because Zundo v2 doesn't expose pause/resume directly on the temporal store instance in this way.
  const pause = useWorkflowStore((state) => state.pauseHistory);
  const resume = useWorkflowStore((state) => state.resumeHistory);
  
  // Access the temporal store injected by Zundo middleware
  const temporalStore = (useWorkflowStore as unknown as { temporal: any }).temporal;
  
  if (!temporalStore) {
    console.warn('Zundo middleware is not initialized properly.');
    return {
      undo: () => {},
      redo: () => {},
      canUndo: false,
      canRedo: false,
      clear: () => {},
      pause: () => {},
      resume: () => {},
      historyLength: 0,
    };
  }

  const { undo, redo, pastStates, futureStates, clear } = useStore(temporalStore, (state: any) => state);

  return {
    undo,
    redo,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    clear,
    historyLength: pastStates.length,
    pause,
    resume,
  };
}