import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { useProjectStore } from './projectStore';

// --- Mocks ---
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
// Mock RECIPES if needed, but we use the real registry which is pure config.

describe('Synnia Full System Test Suite', () => {
    
    beforeEach(() => {
        useProjectStore.setState({
            nodes: [],
            edges: [],
            meta: { id: 'test', name: 'test', createdAt: '', updatedAt: '', thumbnail: null, description: null, author: null }
        });
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('1. Basic CRUD', () => {
        it('should add and delete nodes correctly', () => {
            const store = useProjectStore.getState();
            
            act(() => store.addNode('Text', { x: 0, y: 0 }, { properties: { content: 'A' } }));
            expect(useProjectStore.getState().nodes.length).toBe(1);
            
            const id = useProjectStore.getState().nodes[0].id;
            act(() => store.deleteNode(id));
            expect(useProjectStore.getState().nodes.length).toBe(0);
        });
    });

    describe('2. Wiring & Cycle Prevention', () => {
        it('should prevent cycle creation', () => {
            const store = useProjectStore.getState();
            
            // A -> B
            act(() => {
                store.addNode('Text', { x: 0, y: 0 }, { properties: { name: 'A' } });
                store.addNode('Text', { x: 0, y: 0 }, { properties: { name: 'B' } });
            });
            const [A, B] = useProjectStore.getState().nodes;
            
            act(() => {
                store.onConnect({ source: A.id, target: B.id, sourceHandle: null, targetHandle: null });
            });
            expect(useProjectStore.getState().edges.length).toBe(1);

            // Try B -> A (Cycle)
            act(() => {
                store.onConnect({ source: B.id, target: A.id, sourceHandle: null, targetHandle: null });
            });
            
            // Should still be 1 edge
            expect(useProjectStore.getState().edges.length).toBe(1);
        });
    });

    describe('3. Recipe & Consistency (The Core Flow)', () => {
        it('should propagate Stale status and allow Remake', async () => {
            const store = useProjectStore.getState();

            // 1. Create A
            act(() => store.addNode('Text', { x: 0, y: 0 }, { properties: { content: 'Initial' } }));
            const A = useProjectStore.getState().nodes[0];

            // 2. Run Recipe -> B (Echo)
            await act(async () => await store.runRecipe('debug_echo_id', A.id));
            act(() => vi.runAllTimers());
            
            let B = useProjectStore.getState().nodes.find(n => n.id !== A.id)!;
            expect(B.data.status).toBe('success');
            expect(B.data.provenance?.sources[0].nodeHash).toBe(A.data.hash);

            // 3. Update A -> B should be Stale
            const oldHashA = A.data.hash;
            act(() => store.updateNodeData(A.id, { properties: { content: 'Changed' } }));
            
            const updatedA = useProjectStore.getState().nodes.find(n => n.id === A.id)!;
            B = useProjectStore.getState().nodes.find(n => n.id === B.id)!; // Reload B

            expect(updatedA.data.hash).not.toBe(oldHashA);
            expect(B.data.status).toBe('stale');

            // 4. Remake B
            await act(async () => await store.remakeNode(B.id));
            
            // Check immediate processing state
            B = useProjectStore.getState().nodes.find(n => n.id === B.id)!;
            expect(B.data.status).toBe('processing');

            // Finish async
            act(() => vi.runAllTimers());

            B = useProjectStore.getState().nodes.find(n => n.id === B.id)!;
            
            // Check final state
            expect(B.data.status).toBe('success');
            expect(B.data.provenance?.sources[0].nodeHash).toBe(updatedA.data.hash);
        });
    });

    describe('4. Shortcuts & Edge Cases', () => {
        it('should handle chaining shortcuts and broken links', () => {
            const store = useProjectStore.getState();

            // A -> S1 -> S2
            act(() => store.addNode('Text', { x: 0, y: 0 }, { properties: { name: 'A' } }));
            const A = useProjectStore.getState().nodes[0];
            
            act(() => store.createShortcut(A.id));
            const S1 = useProjectStore.getState().nodes.find(n => n.data.assetType === 'reference_asset')!;
            
            act(() => store.createShortcut(S1.id));
            const S2 = useProjectStore.getState().nodes.find(n => n.id !== S1.id && n.data.assetType === 'reference_asset')!;

            expect(S2.data.properties.targetId).toBe(S1.id);

            // Delete S1 -> S2 Broken?
            // Note: Store doesn't automatically update status of S2 to 'broken' when target deleted.
            // The UI calculates 'isBroken' on render.
            // BUT the 'relink' logic should work.
            
            act(() => store.deleteNode(S1.id));
            
            // Create B
            act(() => store.addNode('Text', { x: 0, y: 0 }, { properties: { name: 'B' } }));
            const B = useProjectStore.getState().nodes.find(n => n.data.properties.name === 'B')!;

            // Relink S2 to B
            act(() => store.relinkShortcut(S2.id, B.id));
            
            const updatedS2 = useProjectStore.getState().nodes.find(n => n.id === S2.id)!;
            expect(updatedS2.data.properties.targetId).toBe(B.id);
        });
    });

});
