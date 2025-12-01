import { useEffect } from 'react';
import { Node } from '@xyflow/react';
import { AssetNodeData } from '@/components/nodes/AssetNode';

interface UseKeyboardShortcutsProps {
    handleManualSave: () => void;
    setNodes: (update: (nds: Node<AssetNodeData>[]) => Node<AssetNodeData>[]) => void;
    setToolMode: (mode: 'select' | 'hand') => void;
    fitView: (options?: any) => void;
    undo: () => void;
    redo: () => void;
    onDelete: () => void; 
    onCopy: () => void;   // New prop
    onPaste: () => void;  // New prop
}

export function useKeyboardShortcuts({
    handleManualSave,
    setNodes,
    setToolMode,
    fitView,
    undo,
    redo,
    onDelete,
    onCopy,   // New
    onPaste   // New
}: UseKeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  
            // Ctrl + C (Copy)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                onCopy();
            }

            // Ctrl + V (Paste)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                onPaste();
            }

            // Ctrl + S
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleManualSave();
            }
  
            // Ctrl + A
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
            }

            // Delete / Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onDelete();
            }
  
            // Tools (Only if no modifiers)
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                if (e.key === 'v') setToolMode('select');
                if (e.key === 'h') setToolMode('hand');
            }
            
            // Fit View
            if (e.shiftKey && e.key === '1') {
                fitView({ duration: 200 });
            }
            
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                 e.preventDefault();
                 if (e.shiftKey) {
                     redo();
                 } else {
                     undo();
                 }
            }
  
            // Redo Alternative (Ctrl + Y)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };
  
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setNodes, handleManualSave, fitView, undo, redo, setToolMode]);
}
