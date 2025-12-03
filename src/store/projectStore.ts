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
import { apiClient } from '@/lib/apiClient'; // Switched to Mock/API Client
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
    isGlobalDragging: boolean; // New Flag
    projectPath: string | null;

    // Actions
    setNodes: (nodes: Node<AssetData>[]) => void;
    setEdges: (edges: Edge[]) => void;
    setIsGlobalDragging: (isDragging: boolean) => void; // New Action
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    
    addNode: (type: string, position: { x: number, y: number }, initialData?: any) => void;
    updateNodeData: (id: string, data: Partial<AssetData>) => void;
    updateNodeParent: (nodeId: string, newParentId: string | undefined) => void; // New Action
    deleteNode: (id: string) => void;
    
    // Recipe Action
    runRecipe: (recipeId: string, sourceNodeId?: string, position?: { x: number, y: number }) => Promise<void>;
    runNodeRecipe: (nodeId: string) => Promise<void>; // New Action
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
            isGlobalDragging: false,
            projectPath: null,

            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),
            setIsGlobalDragging: (isDragging) => set({ isGlobalDragging: isDragging }),

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
                
                // Check for Collapsed State Change
                let updatedNodes = get().nodes;
                
                // If this is a collection and 'collapsed' changed
                if (node.data.assetType === 'collection_asset' && data.properties && 'collapsed' in data.properties) {
                    const newCollapsed = data.properties.collapsed;
                    const oldCollapsed = (node.data.properties as any).collapsed;
                    
                    if (newCollapsed !== oldCollapsed) {
                        // Update direct children visibility
                        updatedNodes = updatedNodes.map(child => {
                            if (child.parentId === id) {
                                return { ...child, hidden: !!newCollapsed };
                            }
                            return child;
                        });
                    }
                }

                // Compute New Hash
                const tempData: AssetData = { 
                    ...node.data, 
                    ...data, 
                    properties: newProps,
                    assetType: data.assetType || node.data.assetType,
                    status: data.status || node.data.status,
                    validationErrors: data.validationErrors || node.data.validationErrors || []
                };
                
                const newHash = computeNodeHash(tempData);
                const oldHash = node.data.hash;

                // Update Target Node
                updatedNodes = updatedNodes.map((n) => {
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
                });

                // Update State
                set({ nodes: updatedNodes });
                
                const isFinishing = data.status === 'success' || data.status === 'idle' || data.status === 'error';
                const wasNotProcessing = node.data.status !== 'processing';
                
                if (oldHash && newHash !== oldHash && (isFinishing || wasNotProcessing)) {
                    propagateStale(id, newHash, get, set);
                }
            },

            updateNodeParent: (nodeId, newParentId) => {
                const nodes = get().nodes;
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return;

                // 1. Detaching (Ejecting)
                if (!newParentId) {
                    if (!node.parentId) return; // Already root

                    const parent = nodes.find(n => n.id === node.parentId);
                    let newPos = node.position;

                    if (parent) {
                        newPos = {
                            x: parent.position.x + node.position.x,
                            y: parent.position.y + node.position.y
                        };
                    }

                    set({
                        nodes: nodes.map(n => 
                            n.id === nodeId 
                                ? { ...n, parentId: undefined, extent: undefined, position: newPos } 
                                : n
                        )
                    });
                    return;
                }

                // 2. Attaching (Dropping into Collection)
                const parent = nodes.find(n => n.id === newParentId);
                if (!parent) return;

                // Calculate Relative Position
                // Note: This assumes node.position is currently absolute (if it was root)
                // If moving from one parent to another, we'd need more complex logic. 
                // For now, assume Root -> Collection flow.
                const relativeX = node.position.x - parent.position.x;
                const relativeY = node.position.y - parent.position.y;

                const updatedNode = {
                    ...node,
                    parentId: newParentId,
                    extent: 'parent', // Constrain to parent bounds? Optional.
                    position: { x: relativeX, y: relativeY }
                };

                // Reorder nodes: Parent must come BEFORE Child for correct rendering/event handling in ReactFlow
                const otherNodes = nodes.filter(n => n.id !== nodeId);
                // We don't strictly need to sort ALL, just ensure child is appended/after parent.
                // But safely, let's just append the updated node to the end.
                set({
                    nodes: [...otherNodes, updatedNode] // Move to end (top z-index)
                });
            },

            deleteNode: (id) => {
                 set({
                    nodes: get().nodes.filter(n => n.id !== id),
                    edges: get().edges.filter(e => e.source !== id && e.target !== id)
                });
            },

            runRecipe: async (recipeId: string, sourceNodeId?: string, position?: { x: number, y: number }) => {
                const recipe = RECIPES.find(r => r.id === recipeId);
                if (!recipe) {
                    toast.error(`Recipe not found: ${recipeId}`);
                    return;
                }

                const outputId = uuidv4();
                let outputPos = position || { x: 100, y: 100 };

                // If source node exists, calculate position relative to it
                if (sourceNodeId) {
                    const sourceNode = get().nodes.find(n => n.id === sourceNodeId);
                    if (sourceNode) {
                        outputPos = { x: sourceNode.position.x + 300, y: sourceNode.position.y };
                    }
                }

                const outputNode: Node<AssetData> = {
                    id: outputId,
                    type: 'Asset',
                    position: outputPos,
                    data: {
                        assetType: recipe.output.assetType,
                        status: 'idle', 
                        properties: { 
                            ...recipe.output.initialProperties,
                            name: `${recipe.label} Output`
                        },
                        hash: 'idle',
                        provenance: {
                            recipeId: recipe.id,
                            generatedAt: 0, 
                            sources: [], 
                            paramsSnapshot: {}
                        },
                        validationErrors: []
                    }
                };

                const newEdges: Edge[] = [];
                if (sourceNodeId) {
                    const newEdge: Edge = {
                        id: `e-${sourceNodeId}-${outputId}`,
                        source: sourceNodeId,
                        target: outputId,
                        type: 'default',
                        animated: true
                    };
                    newEdges.push(newEdge);
                }

                set({ 
                    nodes: [...get().nodes, outputNode],
                    edges: [...get().edges, ...newEdges]
                });
                
                // Flow A: Source provided -> Auto Run
                if (sourceNodeId) {
                    toast.info("Auto-running recipe...");
                    // Small delay to ensure React Flow registers the edge
                    setTimeout(() => {
                        get().runNodeRecipe(outputId);
                    }, 100);
                } else {
                    // Flow B: Manual creation -> Idle
                    toast.success("Recipe Node created. Connect inputs to run.");
                }
            },

            runNodeRecipe: async (nodeId: string) => {
                const node = get().nodes.find(n => n.id === nodeId);
                if (!node || !node.data.provenance) return;

                const recipeId = node.data.provenance.recipeId;
                const recipe = RECIPES.find(r => r.id === recipeId);
                if (!recipe) return;

                // 1. Identify Inputs from Edges
                const edges = get().edges.filter(e => e.target === nodeId);
                
                // Check if we have enough inputs
                // Current logic assumes 1 input slot for simplicity, or we map by order
                // TODO: Robust slot mapping (Handle ID -> Input Slot). 
                // For now, we map all sources to the first input requirement, or just check count.
                
                const requiredInputCount = recipe.inputs.length;
                if (edges.length < requiredInputCount) {
                    toast.error(`Missing inputs. Required: ${requiredInputCount}, Found: ${edges.length}`);
                    return;
                }

                const sources = edges.map(e => {
                    const sourceNode = get().nodes.find(n => n.id === e.source);
                    return {
                        nodeId: e.source,
                        nodeVersion: 1,
                        nodeHash: sourceNode?.data.hash || 'unknown',
                        slot: 'default',
                        data: sourceNode?.data
                    };
                });

                // 2. Validate Inputs
                for (let i = 0; i < requiredInputCount; i++) {
                    const inputDef = recipe.inputs[i];
                    const source = sources[i]; // Simple mapping
                    
                    if (!source || !source.data) continue;

                    // Type Check
                    const type = source.data.assetType;
                    const accepts = inputDef.accepts;
                    if (!accepts.includes('*') && !accepts.some(t => t === type || t === type.toLowerCase())) {
                        toast.error(`Input ${i+1} (${inputDef.label}) expects ${accepts.join(',')}, got ${type}`);
                        return;
                    }

                    // Custom Validation
                    if (inputDef.validate) {
                        const error = inputDef.validate(source.data);
                        if (error) {
                            toast.error(`Input ${i+1} error: ${error}`);
                            return;
                        }
                    }
                }

                // 3. Set Status to Processing
                get().updateNodeData(nodeId, { status: 'processing' });
                
                // 4. Mock Execution
                setTimeout(() => {
                     let resultProps = {};
                     
                     const sourceNode = get().nodes.find(n => n.id === sources[0].nodeId);
                     const sourceContent = sourceNode?.data.properties.content || "";

                     if (recipeId === 'debug_echo_id') {
                        resultProps = {
                             name: 'Node ID Info',
                             content: `Source ID:\n${sources[0].nodeId}\n\nRecipe:\n${recipe.label}`
                        };
                     } else if (recipeId === 'debug_echo_hash') {
                         resultProps = {
                             name: 'Hash Info',
                             content: sources[0].nodeHash
                         };
                     } else if (recipeId === 'debug_reverse_text') {
                         resultProps = {
                             name: 'Reversed',
                             content: (sourceContent as string).split('').reverse().join('')
                         };
                     } else if (recipeId === 'text_to_image') {
                         resultProps = {
                             name: 'AI Generated Image',
                             content: 'https://placehold.co/600x400/png?text=AI+Generated'
                         };
                     } else {
                         resultProps = {
                             name: recipe.output.initialProperties?.name || 'Result',
                             content: 'Processed Content'
                         };
                     }

                     get().updateNodeData(nodeId, {
                         status: 'success',
                         properties: { ...node.data.properties, ...resultProps },
                         provenance: {
                             ...node.data.provenance!,
                             generatedAt: Date.now(),
                             sources: sources.map(s => ({ nodeId: s.nodeId, nodeVersion: s.nodeVersion, nodeHash: s.nodeHash, slot: s.slot }))
                         }
                     });
                     toast.success("Recipe executed successfully");
                }, 1500);
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

                get().updateNodeData(nodeId, { status: 'processing' });
                toast.info(`Remaking ${node.data.properties.name || 'Node'}...`);

                const currentSourceHash = sourceNode.data.hash || computeNodeHash(sourceNode.data);

                // Mock Execution
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

                         get().updateNodeData(nodeId, {
                             status: 'success',
                             properties: resultProps,
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
                         toast.success("Remake complete");
                     }, 1000);
                } else {
                     setTimeout(() => {
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
                get().updateNodeData(id, { provenance: null });
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
                        hash: null, 
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
                    // Use Mock/API Client
                    const project = await apiClient.loadProject(path);
                    
                    const flowNodes: Node<AssetData>[] = project.graph.nodes.map(n => ({
                        id: n.id,
                        type: 'Asset',
                        position: n.position,
                        width: n.width ?? undefined, 
                        height: n.height ?? undefined,
                        // --- Parent/Child Mapping ---
                        parentId: n.parentId,
                        extent: n.extent,
                        expandParent: n.expandParent,
                        // ----------------------------
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

                set({ isSaving: true });

                const synniaNodes: SynniaNode[] = nodes.map(n => ({
                    id: n.id,
                    type: 'Asset',
                    position: n.position,
                    width: n.measured?.width || n.width || null,
                    height: n.measured?.height || n.height || null,
                    // --- Parent/Child Mapping ---
                    parentId: n.parentId,
                    extent: n.extent,
                    expandParent: n.expandParent,
                    // ----------------------------
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
                    // Use Mock/API Client
                    await apiClient.saveGraph?.(); // Noop or console log
                    set({ isSaving: false, meta: project.meta });
                    toast.success(`Project saved (${nodes.length} nodes)`);
                } catch (e) {
                    console.error(e);
                    toast.error(`Failed to save: ${e}`);
                    set({ isSaving: false });
                }
            },
            
            initProject: async (path: string) => {
                 // Force load mock project
                 console.log("[Dev] Force loading Mock Project");
                 await get().loadProject('mock-id');
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