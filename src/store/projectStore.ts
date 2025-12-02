import { create } from 'zustand';
import { temporal } from 'zundo';
import { 
    Node, 
    Edge, 
    OnNodesChange, 
    OnEdgesChange, 
    OnConnect, 
    applyNodeChanges, 
    applyEdgeChanges, 
    Connection
} from '@xyflow/react';
import { SynniaProject, SynniaNode, SynniaEdge, AssetData, ProjectMeta } from '@/types/project';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { RECIPES } from '@/config/recipeRegistry';

// --- Hash Helper ---
const computeNodeHash = (data: AssetData): string => {
    // Simple hash of properties (content, src, etc.)
    // Exclude UI state like status, validationErrors
    const fingerprint = JSON.stringify(data.properties);
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
};

// --- Stale Propagation Helper ---
const propagateStale = (sourceId: string, _newHash: string, get: any, set: any) => {
    const edges = get().edges;
    const nodes = get().nodes;
    
    // Find direct children via edges
    const outEdges = edges.filter((e: Edge) => e.source === sourceId);
    outEdges.forEach((edge: Edge) => {
        const childNode = nodes.find((n: Node<AssetData>) => n.id === edge.target);
        // Check if child actually depends on source via provenance
        if (childNode && childNode.data.provenance) {
            const isDependent = childNode.data.provenance.sources.some((s: any) => s.nodeId === sourceId);
            if (isDependent && childNode.data.status !== 'stale') {
                // Mark Stale
                set({
                    nodes: get().nodes.map((n: Node<AssetData>) => 
                        n.id === childNode.id ? { ...n, data: { ...n.data, status: 'stale' } } : n
                    )
                });
                // Propagation stops here (Lazy)
            }
        }
    });
};

interface ProjectState {
    // Core ReactFlow State
    nodes: Node<AssetData>[];
    edges: Edge[];
    
    // Project Metadata
    meta: ProjectMeta;
    viewport: SynniaProject['viewport'];
    
    // Flags
    isLoading: boolean;
    isSaving: boolean;
    projectPath: string | null;

    // Actions
    setNodes: (nodes: Node<AssetData>[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    
    addNode: (type: string, position: { x: number, y: number }, initialData?: any) => void;
    updateNodeData: (id: string, data: Partial<AssetData>) => void;
    deleteNode: (id: string) => void;
    
    // Recipe Action
    runRecipe: (recipeId: string, sourceNodeId: string) => Promise<void>;
    remakeNode: (nodeId: string) => Promise<void>;
    detachNode: (nodeId: string) => void; // Add this
    createShortcut: (sourceNodeId: string, position?: { x: number, y: number }) => void;
    relinkShortcut: (shortcutId: string, newTargetId: string) => void;

    // Async Actions
    loadProject: (path: string) => Promise<void>;
    saveProject: () => Promise<void>;
    initProject: (path: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
    temporal(
        (set, get) => ({
            nodes: [],
            edges: [],
            meta: {
                id: '',
                name: 'Untitled',
                createdAt: '',
                updatedAt: '',
                thumbnail: null,
                description: null,
                author: null
            },
            viewport: { x: 0, y: 0, zoom: 1 },
            isLoading: false,
            isSaving: false,
            projectPath: null,

            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),

            onNodesChange: (changes) => {
                set({
                    nodes: applyNodeChanges(changes, get().nodes) as Node<AssetData>[],
                });
            },

            onEdgesChange: (changes) => {
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },

            onConnect: (connection: Connection) => {
                const { source, target } = connection;
                if (!source || !target) return;
                
                // Currently, manual wiring is disabled because we use Smart Wiring (Recipe Picker)
                // or Shortcuts for connections. Direct connections imply data flow which needs Slot logic.
                toast.info("Drag to empty space to create a new node from recipe.");
                
                /* 
                // Cycle Prevention & Edge Addition (Disabled for v3.1)
                const nodes = get().nodes;
                const edges = get().edges;
                const tempEdge: Edge = { id: 'temp', source, target };
                
                if (hasCycle(nodes, edges, tempEdge)) {
                    toast.error("Cycle detected! Cannot connect.");
                    return;
                }

                set({
                    edges: addEdge(connection, get().edges),
                });
                */
            },

            addNode: (type, position, initialData) => {
                const id = uuidv4();
                
                let assetType = type;
                let properties: Record<string, any> = { name: `${type} ${id.slice(0, 4)}` };

                if (!initialData) {
                     if (type === 'Image') { assetType = 'image_asset'; properties.name = 'New Image'; }
                     else if (type === 'Text') { assetType = 'text_asset'; properties.content = 'New Note'; }
                     else if (type === 'Prompt') { assetType = 'prompt_asset'; properties.content = ''; }
                } else {
                    assetType = initialData.assetType || type;
                    properties = { ...initialData.properties };
                    if (typeof initialData === 'string') {
                        properties.content = initialData;
                        if (type === 'Image') { assetType = 'image_asset'; properties.name = 'Imported Image'; }
                    }
                }

                const initialHash = computeNodeHash({ assetType, status: 'idle', properties } as AssetData);

                const newNode: Node<AssetData> = {
                    id,
                    type: 'Asset',
                    position,
                    data: {
                        assetType,
                        status: 'idle',
                        properties,
                        hash: initialHash, 
                        provenance: null,
                        validationErrors: []
                    }
                };

                set({ nodes: [...get().nodes, newNode] });
            },

            updateNodeData: (id, data) => {
                const node = get().nodes.find(n => n.id === id);
                if (!node) return;

                const currentProps = node.data.properties || {};
                const newProps = data.properties 
                    ? { ...currentProps, ...data.properties }
                    : currentProps;
                
                // Compute New Hash
                // We construct a temp object representing the new state to compute hash
                const tempData: AssetData = { 
                    ...node.data, 
                    ...data, 
                    properties: newProps,
                    // Ensure required fields for AssetData if data is partial
                    assetType: data.assetType || node.data.assetType,
                    status: data.status || node.data.status,
                    validationErrors: data.validationErrors || node.data.validationErrors || []
                };
                
                const newHash = computeNodeHash(tempData);
                const oldHash = node.data.hash;

                // Update State
                set({
                    nodes: get().nodes.map((n) => {
                        if (n.id === id) {
                            return { 
                                ...n, 
                                data: { 
                                    ...n.data, 
                                    ...data,
                                    properties: newProps,
                                    hash: newHash 
                                } 
                            };
                        }
                        return n;
                    }),
                });

                // If Hash Changed, Propagate Stale
                // Propagate if:
                // 1. Hash actually changed
                // 2. AND (Node was NOT processing OR Node IS NOW becoming success/idle/error)
                // Essentially, avoid propagating intermediate processing states if hash is unstable,
                // but MUST propagate when result lands.
                
                const isFinishing = data.status === 'success' || data.status === 'idle' || data.status === 'error';
                const wasNotProcessing = node.data.status !== 'processing';
                
                if (oldHash && newHash !== oldHash && (isFinishing || wasNotProcessing)) {
                    propagateStale(id, newHash, get, set);
                }
            },

            deleteNode: (id) => {
                 set({
                    nodes: get().nodes.filter(n => n.id !== id),
                    edges: get().edges.filter(e => e.source !== id && e.target !== id)
                });
            },

            runRecipe: async (recipeId: string, sourceNodeId: string) => {
                const recipe = RECIPES.find(r => r.id === recipeId);
                if (!recipe) {
                    toast.error(`Recipe not found: ${recipeId}`);
                    return;
                }

                const sourceNode = get().nodes.find(n => n.id === sourceNodeId);
                if (!sourceNode) return;

                const outputId = uuidv4();
                const offset = 300;
                const outputPos = { x: sourceNode.position.x + offset, y: sourceNode.position.y };

                const sourceHash = sourceNode.data.hash || computeNodeHash(sourceNode.data);

                const outputNode: Node<AssetData> = {
                    id: outputId,
                    type: 'Asset',
                    position: outputPos,
                    data: {
                        assetType: recipe.output.assetType,
                        status: 'processing', 
                        properties: { ...recipe.output.initialProperties },
                        hash: 'processing',
                        provenance: {
                            recipeId: recipe.id,
                            generatedAt: Date.now(),
                            sources: [{ 
                                nodeId: sourceNodeId, 
                                nodeVersion: 1, 
                                nodeHash: sourceHash, 
                                slot: 'default' 
                            }],
                            paramsSnapshot: {}
                        },
                        validationErrors: []
                    }
                };

                const newEdge: Edge = {
                    id: `e-${sourceNodeId}-${outputId}`,
                    source: sourceNodeId,
                    target: outputId,
                    type: 'default',
                    animated: true
                };

                set({ 
                    nodes: [...get().nodes, outputNode],
                    edges: [...get().edges, newEdge]
                });

                // 3. Execute Logic (Async)
                // For "debug_echo_id", we implement logic right here for now.
                // Later this will call `invoke('run_agent', ...)`
                if (recipeId.startsWith('debug_')) {
                     setTimeout(() => {
                         let resultProps = {};
                         
                         if (recipeId === 'debug_echo_id') {
                            resultProps = {
                                 name: 'Node ID Info',
                                 content: `Source ID:\n${sourceNodeId}\n\nRecipe:\n${recipe.label}`
                            };
                         } else if (recipeId === 'debug_echo_hash') {
                             resultProps = {
                                 name: 'Hash Info',
                                 content: sourceHash
                             };
                         } else if (recipeId === 'debug_reverse_text') {
                             const text = sourceNode.data.properties.content || "";
                             resultProps = {
                                 name: 'Reversed',
                                 content: text.split('').reverse().join('')
                             };
                         }

                         get().updateNodeData(outputId, {
                             status: 'success',
                             properties: resultProps
                         });
                         toast.success("Debug recipe complete");
                     }, 1000); // Fake delay
                } else {
                    // TODO: Call Backend Agent
                    toast.info(`Agent ${recipe.agentId} triggered (Mock)`);
                    setTimeout(() => {
                         get().updateNodeData(outputId, { status: 'success' });
                    }, 2000);
                }
            },

            remakeNode: async (nodeId: string) => {
                const node = get().nodes.find(n => n.id === nodeId);
                if (!node) return;

                const prov = node.data.provenance;
                if (!prov) {
                    toast.error("Cannot remake a raw asset (no recipe).");
                    return;
                }

                const recipe = RECIPES.find(r => r.id === prov.recipeId);
                if (!recipe) {
                    toast.error(`Original recipe ${prov.recipeId} not found.`);
                    return;
                }

                // Assuming single source for now
                const sourceId = prov.sources[0]?.nodeId;
                const sourceNode = get().nodes.find(n => n.id === sourceId);
                
                if (!sourceNode) {
                    toast.error("Source node missing. Cannot remake.");
                    return;
                }

                // 1. Update Status -> Processing
                get().updateNodeData(nodeId, { status: 'processing' });
                toast.info(`Remaking ${node.data.properties.name || 'Node'}...`);

                // 2. Calculate New Source Hash (In case it changed)
                const currentSourceHash = sourceNode.data.hash || computeNodeHash(sourceNode.data);

                // 3. Execute Logic (Async) - Reusing logic from runRecipe roughly
                // In a real app, we'd refactor the execution logic into a shared helper.
                if (prov.recipeId.startsWith('debug_')) {
                     setTimeout(() => {
                         let resultProps = {};
                         
                         if (prov.recipeId === 'debug_echo_id') {
                            resultProps = {
                                 name: 'Node ID Info',
                                 content: `Source ID:\n${sourceId}\n\nRecipe:\n${recipe.label}`
                            };
                         } else if (prov.recipeId === 'debug_echo_hash') {
                             resultProps = {
                                 name: 'Hash Info',
                                 content: currentSourceHash
                             };
                         } else if (prov.recipeId === 'debug_reverse_text') {
                             const text = sourceNode.data.properties.content || "";
                             resultProps = {
                                 name: 'Reversed',
                                 content: text.split('').reverse().join('')
                             };
                         }

                         // 4. Update Node with Result AND New Provenance
                         get().updateNodeData(nodeId, {
                             status: 'success',
                             properties: resultProps,
                             provenance: {
                                 ...prov,
                                 generatedAt: Date.now(),
                                 sources: [{ 
                                     nodeId: sourceId, 
                                     nodeVersion: prov.sources[0].nodeVersion, // Should we bump source version? Not strictly needed for hash check.
                                     nodeHash: currentSourceHash, // CRITICAL: Update stored hash to match current source
                                     slot: 'default' 
                                 }]
                             }
                         });
                         toast.success("Remake complete");
                     }, 1000);
                } else {
                     // Mock Backend Call
                     setTimeout(() => {
                         // Assume result props might change or stay same. 
                         // For mock, we just set status success and update timestamp.
                         get().updateNodeData(nodeId, { 
                             status: 'success',
                             provenance: {
                                 ...prov,
                                 generatedAt: Date.now(),
                                 sources: [{ 
                                     nodeId: sourceId, 
                                     nodeVersion: prov.sources[0].nodeVersion,
                                     nodeHash: currentSourceHash,
                                     slot: 'default' 
                                 }]
                             }
                        });
                     }, 2000);
                }
            },

            detachNode: (id: string) => {
                // 1. Clear Provenance (make it a raw asset)
                get().updateNodeData(id, { provenance: null });
                
                // 2. Remove Incoming Edges (physically disconnect from parents)
                set({
                    edges: get().edges.filter(e => e.target !== id)
                });
                
                toast.success("Node detached.");
            },

            createShortcut: (sourceNodeId: string, position?: { x: number, y: number }) => {
                const sourceNode = get().nodes.find(n => n.id === sourceNodeId);
                if (!sourceNode) return;

                const id = uuidv4();
                const pos = position || { x: sourceNode.position.x + 50, y: sourceNode.position.y + 50 };

                const shortcutNode: Node<AssetData> = {
                    id,
                    type: 'Asset',
                    position: pos,
                    data: {
                        assetType: 'reference_asset',
                        status: 'idle',
                        properties: { 
                            name: `Shortcut to ${sourceNode.data.properties.name || 'Asset'}`, 
                            targetId: sourceNodeId 
                        },
                        hash: null, // Hash of reference? Or null? Let's say null for now or compute it.
                        provenance: null,
                        validationErrors: []
                    }
                };

                const linkEdge: Edge = {
                    id: `link-${sourceNodeId}-${id}`,
                    source: sourceNodeId,
                    target: id,
                    type: 'default',
                    animated: false,
                    style: { strokeDasharray: '5,5', opacity: 0.5 }
                };

                set({ 
                    nodes: [...get().nodes, shortcutNode],
                    edges: [...get().edges, linkEdge]
                });
                
                toast.success("Shortcut created");
            },

            relinkShortcut: (shortcutId: string, newTargetId: string) => {
                const nodes = get().nodes;
                const shortcut = nodes.find(n => n.id === shortcutId);
                const target = nodes.find(n => n.id === newTargetId);

                if (!shortcut || !target) {
                    toast.error("Invalid shortcut or target");
                    return;
                }

                get().updateNodeData(shortcutId, {
                    properties: {
                        ...shortcut.data.properties,
                        targetId: newTargetId,
                    }
                });

                const oldTargetId = shortcut.data.properties.targetId;
                const edges = get().edges.filter(e => !(e.source === oldTargetId && e.target === shortcutId));
                
                const newLinkEdge: Edge = {
                    id: `link-${newTargetId}-${shortcutId}`,
                    source: newTargetId,
                    target: shortcutId,
                    type: 'default',
                    animated: false,
                    style: { strokeDasharray: '5,5', opacity: 0.5 }
                };

                set({ edges: [...edges, newLinkEdge] });
                toast.success(`Relinked to ${target.data.properties.name}`);
            },

            loadProject: async (path: string) => {
                set({ isLoading: true });
                try {
                    const project = await invoke<SynniaProject>('load_project', { path });
                    
                    const flowNodes: Node<AssetData>[] = project.graph.nodes.map(n => ({
                        id: n.id,
                        type: 'Asset',
                        position: n.position,
                        width: n.width ?? undefined, 
                        height: n.height ?? undefined,
                        data: n.data
                    }));

                    const flowEdges: Edge[] = project.graph.edges.map(e => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        type: e.type || 'default', 
                        animated: e.animated ?? undefined,
                        label: e.label ?? undefined,
                        style: e.animated ? undefined : { strokeDasharray: '5,5', opacity: 0.5 }
                    }));

                    set({
                        nodes: flowNodes,
                        edges: flowEdges,
                        meta: project.meta,
                        viewport: project.viewport,
                        projectPath: path,
                        isLoading: false
                    });
                    
                    toast.success(`Loaded project: ${project.meta.name}`);

                } catch (e) {
                    console.error(e);
                    toast.error(`Failed to load project: ${e}`);
                    set({ isLoading: false });
                }
            },

            saveProject: async () => {
                const { nodes, edges, meta, viewport, projectPath } = get();
                if (!projectPath) return;

                // DEBUG: Log count
                console.log(`Saving project with ${nodes.length} nodes and ${edges.length} edges.`);
                if (nodes.length > 0) {
                    console.log("First node sample:", nodes[0]);
                }

                set({ isSaving: true });

                const synniaNodes: SynniaNode[] = nodes.map(n => ({
                    id: n.id,
                    type: 'Asset',
                    position: n.position,
                    width: n.measured?.width || n.width || null,
                    height: n.measured?.height || n.height || null,
                    data: n.data
                }));

                const synniaEdges: SynniaEdge[] = edges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    type: (e.type as string) || 'default',
                    label: (e.label as string) || null,
                    sourceHandle: e.sourceHandle || null,
                    targetHandle: e.targetHandle || null,
                    animated: e.animated || null
                }));

                const project: SynniaProject = {
                    version: "2.0.0",
                    meta: { ...meta, updatedAt: new Date().toISOString() },
                    viewport,
                    graph: {
                        nodes: synniaNodes,
                        edges: synniaEdges
                    },
                    settings: {}
                };

                try {
                    await invoke('save_project', { project });
                    set({ isSaving: false, meta: project.meta });
                    toast.success(`Project saved (${nodes.length} nodes)`);
                } catch (e) {
                    console.error(e);
                    toast.error(`Failed to save: ${e}`);
                    set({ isSaving: false });
                }
            },
            
            initProject: async (path: string) => {
                 await get().loadProject(path);
            }
        }),
        {
            limit: 100,
            partialize: (state) => {
                const { isLoading, isSaving, projectPath, meta, viewport, ...rest } = state;
                return rest;
            },
        }
    )
);