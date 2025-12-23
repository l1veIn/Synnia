import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useHistory } from '@/hooks/useHistory';
import { graphEngine } from '@core/engine/GraphEngine';

export function useGlobalShortcuts(onSave?: () => void) {
  const { getNodes, getEdges, deleteElements } = useReactFlow();
  const { undo, redo } = useHistory();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (
        (event.target as HTMLElement).tagName === 'INPUT' ||
        (event.target as HTMLElement).tagName === 'TEXTAREA' ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Delete
      else if (event.key === 'Backspace' || event.key === 'Delete') {
        if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;

        event.preventDefault();

        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
          selectedNodes.forEach(node => {
            graphEngine.mutator.removeNode(node.id);
          });
        }

        const selectedEdges = getEdges().filter(e => e.selected);
        if (selectedEdges.length > 0) {
          deleteElements({ edges: selectedEdges });
        }
      }

      if (event.metaKey || event.ctrlKey) {
        // Save (Cmd+S)
        if (event.code === 'KeyS') {
          event.preventDefault();
          onSave?.();
        }
        // Undo / Redo
        else if (event.code === 'KeyZ') {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        // Windows style Redo (Ctrl+Y)
        else if (event.key === 'y') {
          event.preventDefault();
          redo();
        }
        // Duplicate (Cmd+D)
        else if (event.key === 'd') {
          event.preventDefault();
          const selectedNodes = getNodes().filter(n => n.selected);
          selectedNodes.forEach(node => {
            graphEngine.mutator.duplicateNode(node as any);
          });
        }
        // Copy (Cmd+C)
        else if (event.key === 'c') {
          const selectedNodes = getNodes().filter(n => n.selected);

          if (selectedNodes.length > 0) {
            event.preventDefault();

            const allNodes = getNodes();
            const getAllDescendants = (rootIds: string[]) => {
              const result = new Set<string>(rootIds);
              const queue = [...rootIds];
              while (queue.length > 0) {
                const id = queue.shift()!;
                const children = allNodes.filter(n => n.parentId === id);
                children.forEach(c => {
                  if (!result.has(c.id)) {
                    result.add(c.id);
                    queue.push(c.id);
                  }
                });
              }
              return allNodes.filter(n => result.has(n.id));
            };

            const nodesToCopy = getAllDescendants(selectedNodes.map(n => n.id));

            localStorage.setItem('synnia-clipboard', JSON.stringify(nodesToCopy));
            console.log('Copied', nodesToCopy.length, 'nodes (including descendants)');
          }
        }
        // Paste (Cmd+V)
        else if (event.key === 'v') {
          event.preventDefault();
          try {
            const clipboard = localStorage.getItem('synnia-clipboard');
            if (clipboard) {
              const nodes = JSON.parse(clipboard);
              if (Array.isArray(nodes) && nodes.length > 0) {
                graphEngine.mutator.pasteNodes(nodes);
                console.log('Pasted', nodes.length, 'nodes');
              }
            }
          } catch (e) {
            console.error('Failed to paste', e);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, getEdges, deleteElements, undo, redo, onSave]);
}
