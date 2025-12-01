import { useState, useCallback } from 'react';

interface Command {
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

export function useUndoRedo() {
    const [undoStack, setUndoStack] = useState<Command[]>([]);
    const [redoStack, setRedoStack] = useState<Command[]>([]);

    const record = useCallback((command: Command) => {
        setUndoStack(prev => {
            const next = [...prev, command];
            return next;
        });
        setRedoStack([]); 
    }, []);

    const undo = useCallback(async () => {
        if (undoStack.length === 0) return;
        const command = undoStack[undoStack.length - 1];
        try {
            await command.undo();
        } catch (e) {
            // Keep error logging in development for now, can be removed later.
            // console.error("Undo failed", e);
        }
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, command]);
    }, [undoStack]);

    const redo = useCallback(async () => {
        if (redoStack.length === 0) return;
        const command = redoStack[redoStack.length - 1];
        try {
            await command.redo();
        } catch (e) {
            // console.error("Redo failed", e);
        }
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, command]);
    }, [redoStack]);

    return {
        record,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0
    };
}
