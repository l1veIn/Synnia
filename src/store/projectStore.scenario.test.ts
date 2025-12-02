import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { useProjectStore } from './projectStore';

// --- Mocks ---
// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }
}));

// Mock UUID to have predictable IDs if needed, 
// but for this test random IDs are fine as long as we capture them.

describe('Project Store Scenarios (User Flows)', () => {
    
    // Reset store before each test
    beforeEach(() => {
        useProjectStore.setState({
            nodes: [],
            edges: [],
            meta: { id: 'test', name: 'test', createdAt: '', updatedAt: '', thumbnail: null, description: null, author: null }
        });
        vi.clearAllMocks();
        vi.useFakeTimers(); // For mocking async recipes
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Scenario 1: Recipe Generation & Stale Propagation', async () => {
        const store = useProjectStore.getState();
        
        // 1. User creates Node A (The Input)
        // -------------------------------------------------
        act(() => {
            store.addNode('Text', { x: 0, y: 0 }, { properties: { content: 'Hello World' } });
        });
        
        let nodes = useProjectStore.getState().nodes;
        expect(nodes.length).toBe(1);
        const nodeA = nodes[0];
        const hashA_v1 = nodeA.data.hash;
        
        expect(hashA_v1).toBeTruthy();
        expect(nodeA.data.properties.content).toBe('Hello World');

        // 2. User runs Recipe on A -> Generates Node B
        // -------------------------------------------------
        // We use 'debug_echo_id' recipe which is synchronous-ish in our mock
        const recipeId = 'debug_echo_id';
        
        await act(async () => {
            await store.runRecipe(recipeId, nodeA.id);
        });

        // Fast-forward timers to let the "mock agent" finish
        act(() => {
            vi.runAllTimers();
        });

        nodes = useProjectStore.getState().nodes;
        expect(nodes.length).toBe(2);
        
        const nodeB = nodes.find(n => n.id !== nodeA.id)!;
        
        // CHECK: Node B should be connected to A
        const edges = useProjectStore.getState().edges;
        expect(edges.length).toBe(1);
        expect(edges[0].source).toBe(nodeA.id);
        expect(edges[0].target).toBe(nodeB.id);

        // CHECK: Node B Provenance
        expect(nodeB.data.provenance).toBeTruthy();
        expect(nodeB.data.provenance?.recipeId).toBe(recipeId);
        expect(nodeB.data.provenance?.sources[0].nodeId).toBe(nodeA.id);
        // CRITICAL: B must record A's hash
        expect(nodeB.data.provenance?.sources[0].nodeHash).toBe(hashA_v1);
        
        // CHECK: Node B Status (Should be success after timer)
        expect(nodeB.data.status).toBe('success');

        // 3. User Modifies Node A -> B should become Stale
        // -------------------------------------------------
        act(() => {
            store.updateNodeData(nodeA.id, { 
                properties: { content: 'Hello UNIVERSE' } 
            });
        });

        const updatedNodeA = useProjectStore.getState().nodes.find(n => n.id === nodeA.id)!;
        const updatedNodeB = useProjectStore.getState().nodes.find(n => n.id === nodeB.id)!;

        // CHECK: A's hash changed
        expect(updatedNodeA.data.hash).not.toBe(hashA_v1);
        
        // CHECK: B's status became 'stale'
        // Because B expects hashA_v1, but A is now hashA_v2
        expect(updatedNodeB.data.status).toBe('stale');
    });

    it('Scenario 2: Shortcuts & Relinking', () => {
        const store = useProjectStore.getState();

        // 1. Create Node A
        act(() => {
            store.addNode('Image', { x: 0, y: 0 }, { properties: { name: 'MyPic.png' } });
        });
        const nodeA = useProjectStore.getState().nodes[0];

        // 2. Create Shortcut S to A
        act(() => {
            store.createShortcut(nodeA.id);
        });

        const nodes = useProjectStore.getState().nodes;
        const shortcut = nodes.find(n => n.data.assetType === 'reference_asset')!;
        
        expect(shortcut).toBeTruthy();
        expect(shortcut.data.properties.targetId).toBe(nodeA.id);
        
        // 3. Relink Shortcut to a New Node C
        act(() => {
            store.addNode('Image', { x: 100, y: 100 }, { properties: { name: 'NewPic.png' } });
        });
        const nodeC = useProjectStore.getState().nodes.find(n => n.data.properties.name === 'NewPic.png')!;

        act(() => {
            store.relinkShortcut(shortcut.id, nodeC.id);
        });

        const updatedShortcut = useProjectStore.getState().nodes.find(n => n.id === shortcut.id)!;
        expect(updatedShortcut.data.properties.targetId).toBe(nodeC.id);
        
        // Check Edge updated
        const edges = useProjectStore.getState().edges;
        const linkEdge = edges.find(e => e.target === shortcut.id)!;
        expect(linkEdge.source).toBe(nodeC.id);
    });

    it('Scenario 3: Remake (Update Propagation)', async () => {
        const store = useProjectStore.getState();
        
        // Setup: A -> B (Stale)
        // We manually construct this state to save time
        const idA = 'node-a';
        const idB = 'node-b';
        
        useProjectStore.setState({
            nodes: [
                {
                    id: idA, type: 'Asset', position: {x:0, y:0},
                    data: { 
                        assetType: 'text', status: 'idle', 
                        properties: { content: 'Version 2' }, 
                        hash: 'hash-v2', provenance: null, validationErrors: [] 
                    }
                },
                {
                    id: idB, type: 'Asset', position: {x:100, y:0},
                    data: { 
                        assetType: 'text', status: 'stale', 
                        properties: { content: 'Result of Version 1' }, 
                        hash: 'hash-result-v1', 
                        provenance: {
                            recipeId: 'debug_echo_id',
                            generatedAt: 0,
                            sources: [{ nodeId: idA, nodeVersion: 1, nodeHash: 'hash-v1', slot: 'default' }],
                            paramsSnapshot: {}
                        }, 
                        validationErrors: [] 
                    }
                }
            ],
            edges: [{ id: 'e1', source: idA, target: idB }]
        });

        // 1. User clicks "Run Recipe" again on A, effectively Remaking B?
        // In our current UI, user usually selects A and runs recipe again, producing C.
        // OR user selects B and clicks "Remake" (Not implemented in Store yet!).
        
        // WAIT: Our store only has `runRecipe(recipeId, sourceId)`.
        // This creates a NEW output node. It does not update B.
        // This reveals a GAP in our implementation: We don't have "Remake Node" action yet!
        
        // Let's test the "Create New Version" flow instead, which is what we have.
        
        await act(async () => {
            await store.runRecipe('debug_echo_id', idA);
        });
        
        act(() => { vi.runAllTimers(); });

        const nodes = useProjectStore.getState().nodes;
        // Should have A, B, and C (New Result)
        expect(nodes.length).toBe(3);
        
        const nodeC = nodes.find(n => n.id !== idA && n.id !== idB)!;
        
        // C should be success
        expect(nodeC.data.status).toBe('success');
        // C should record A's CURRENT hash (hash-v2)
        expect(nodeC.data.provenance?.sources[0].nodeHash).toBe('hash-v2');
    });

    it('Scenario 4: Complex Shortcuts & Data Flow', async () => {
        const store = useProjectStore.getState();

        // 1. Create Source A
        act(() => {
            store.addNode('Text', { x: 0, y: 0 }, { properties: { content: 'ABC' } });
        });
        const nodeA = useProjectStore.getState().nodes[0];

        // 2. Create Shortcut S1 -> A
        act(() => { store.createShortcut(nodeA.id, { x: 100, y: 0 }); });
        const shortcutS1 = useProjectStore.getState().nodes.find(n => n.data.assetType === 'reference_asset')!;

        // 3. Create Shortcut S2 -> S1 (Chain)
        // Note: UI should probably resolve S1 to A, but if we allow S -> S -> A, let's test it.
        // Store.createShortcut(sourceId) uses sourceId as target.
        act(() => { store.createShortcut(shortcutS1.id, { x: 200, y: 0 }); });
        const shortcutS2 = useProjectStore.getState().nodes.find(n => n.id !== shortcutS1.id && n.data.assetType === 'reference_asset')!;

        expect(shortcutS2.data.properties.targetId).toBe(shortcutS1.id);

        // 4. Run "Debug Reverse" on S2 (Should act on ultimate target A?)
        // Currently `runRecipe` uses `sourceNodeId` directly. 
        // If source is a Shortcut, does it resolve to target?
        // The current implementation of `runRecipe` does NOT automatically resolve shortcuts.
        // It treats the Shortcut Node as the input.
        // Recipe 'debug_reverse_text' accepts 'text_asset'. Shortcut is 'reference_asset'.
        // So strictly speaking, it should fail or do nothing if type mismatch.
        // BUT, let's see if we can make it work or if it fails as expected.
        // If we want S2 to behave like A, the recipe logic needs to traverse the link.
        
        // Let's Test: Recipe on A, verify result.
        await act(async () => {
            await store.runRecipe('debug_reverse_text', nodeA.id);
        });
        act(() => { vi.runAllTimers(); });
        
        const resultNode = useProjectStore.getState().nodes.find(n => n.data.properties.name === 'Reversed')!;
        expect(resultNode.data.properties.content).toBe('CBA');

        // 5. Modify A -> Verify Hash changes in Reverse Node?
        // No, result is independent until remade.
        // But result should be marked Stale.
        
        act(() => {
            store.updateNodeData(nodeA.id, { properties: { content: 'XYZ' } });
        });
        
        const updatedResult = useProjectStore.getState().nodes.find(n => n.id === resultNode.id)!;
        expect(updatedResult.data.status).toBe('stale');

        // 6. Remake Result (Run Recipe again on A)
        await act(async () => {
             await store.runRecipe('debug_reverse_text', nodeA.id);
        });
        act(() => { vi.runAllTimers(); });
        
        // We expect a NEW result node (since runRecipe creates new).
        // The old result node remains stale (unless we explicitly delete/replace it).
        const newResult = useProjectStore.getState().nodes.find(n => 
            n.data.properties.name === 'Reversed' && n.id !== resultNode.id
        )!;
        
        expect(newResult.data.properties.content).toBe('ZYX');
        expect(newResult.data.status).toBe('success');
    });

});
