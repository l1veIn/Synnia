import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';

export function useGlobalShortcuts() {
  const { getNodes, getEdges, deleteElements } = useReactFlow();
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const pasteNodes = useWorkflowStore((state) => state.pasteNodes);
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
            // 忽略输入框内的删除
            if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;

            event.preventDefault();
            
            // Handle Node Deletion
            const selectedNodes = getNodes().filter(n => n.selected);
            if (selectedNodes.length > 0) {
                selectedNodes.forEach(node => {
                    removeNode(node.id);
                });
            }

            // Handle Edge Deletion
            const selectedEdges = getEdges().filter(e => e.selected);
            if (selectedEdges.length > 0) {
                deleteElements({ edges: selectedEdges });
            }
        }

      // Shortcuts with Modifier (Cmd/Ctrl)
      if (event.metaKey || event.ctrlKey) {
        // Undo / Redo
        if (event.code === 'KeyZ') {
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
        // Copy (Cmd+C)
        else if (event.key === 'c') {
            const selectedNodes = getNodes().filter(n => n.selected);
            
            if (selectedNodes.length > 0) {
                event.preventDefault(); 

                // Helper to find descendants recursively
                const allNodes = getNodes();
                const getAllDescendants = (rootIds: string[]) => {
                    const result = new Set<string>(rootIds);
                    const queue = [...rootIds];
                    while(queue.length > 0) {
                        const id = queue.shift()!;
                        
                        // Find children
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
                        pasteNodes(nodes);
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
  }, [getNodes, removeNode, undo, redo, pasteNodes]);
}
