import { GraphEngine } from './GraphEngine';
import { SynniaNode } from '@/types/project';
import { ValueType, FieldDefinition } from '@/types/assets';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { XYPosition } from '@xyflow/react';
import { createNodeUseCase } from '@/application/use-cases/create-node';
import { resolveNodeAssetId } from '@core/utils/nodeAsset';

// ============================================================================
// Smart Node Creation API (TEP Crystallized)
// ============================================================================

/**
 * Unified specification for creating nodes.
 * Either `assetId` (reuse) or `value` (create new) must be provided.
 */
export interface SmartNodeSpec {
    // ═══════════════════════════════════════════
    // ASSET LAYER - Provide assetId OR value
    // ═══════════════════════════════════════════
    assetId?: string;              // Reuse existing Asset (skip creation)
    value?: any;                   // Create new Asset with this data
    valueType?: ValueType;         // 'record' | 'array' | 'string' (inferred)
    schema?: FieldDefinition[];    // Asset.config.schema (inferred)
    config?: Record<string, any>;  // Asset.config.extra

    // ═══════════════════════════════════════════
    // FILE LAYER (Phase 3 DDD)
    // ═══════════════════════════════════════════
    fileIds?: string[];            // References to File aggregates for heavy resources

    // ═══════════════════════════════════════════
    // NODE LAYER
    // ═══════════════════════════════════════════
    node?: string;                 // Node type (inferred from valueType)
    name?: string;                 // Asset.sys.name & Node.data.title
    collapsed?: boolean;           // Node.data.collapsed (default: false)
    style?: Record<string, any>;   // Node.style overrides

    // ═══════════════════════════════════════════
    // LAYOUT LAYER
    // ═══════════════════════════════════════════
    position?: XYPosition | 'auto';
    anchor?: string;               // Node ID to position relative to
    offset?: 'below' | 'right' | XYPosition;

    // ═══════════════════════════════════════════
    // CONNECTION LAYER
    // ═══════════════════════════════════════════
    connectFrom?: { nodeId: string; handle: string };
    outputEdgeFrom?: string;       // Shorthand: create output edge from this node

    // ═══════════════════════════════════════════
    // SPECIAL MODES
    // ═══════════════════════════════════════════
    mode?: 'create' | 'reference';
    referenceOf?: string;          // Required when mode='reference'
    dockedTo?: string;             // Dock to this node
}

// ============================================================================
// Inference Utilities
// ============================================================================

/**
 * Infer ValueType from value
 */
function inferValueType(value: any): ValueType {
    if (Array.isArray(value)) return 'array';
    // Everything else is 'record' (even primitives will be wrapped)
    return 'record';
}

/**
 * Infer schema from value structure
 */
function inferSchema(value: any): FieldDefinition[] {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        // Infer from first array item
        return Object.keys(value[0]).map(key => ({
            key,
            label: key,
            type: typeof value[0][key] === 'number' ? 'number' : 'string',
        }));
    }
    if (typeof value === 'object' && value !== null) {
        return Object.keys(value).map(key => ({
            key,
            label: key,
            type: typeof value[key] === 'number' ? 'number' : 'string',
        }));
    }
    return [];
}

/**
 * Map valueType to default node type
 */
function valueTypeToNode(valueType: ValueType): string {
    switch (valueType) {
        case 'array': return 'table';
        case 'record': return 'form';
        default: return 'form';
    }
}

// ============================================================================
// NOTE: Node-specific logic (default content, build from data, etc.)
// is defined in each node's config via factory methods.
// See: src/lib/engine/引擎设计原则.md
// ============================================================================


export class GraphMutator {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }


    public removeNode(id: string) {
        // Use Engine Batch Primitive (no children traversal needed)
        this.engine.deleteNodes([id]);
    }

    public duplicateNode(node: SynniaNode, position?: XYPosition) {
        const { assets } = this.engine.state;
        const assetId = resolveNodeAssetId(node);
        const originalAsset = assetId ? assets[assetId] : null;

        if (!originalAsset) {
            // No asset to clone, just create a basic node
            const newId = this.createSmart({
                value: {},
                node: node.type,
                name: `${node.data.title || 'Node'} (Copy)`,
                position: position || { x: node.position.x + 20, y: node.position.y + 20 },
                style: node.style,
            });
            if (newId) {
                this.engine.deselectAll();
                this.engine.setNodes(this.engine.state.nodes.map(n =>
                    n.id === newId ? { ...n, selected: true } : n
                ));
            }
            return;
        }

        // Clone asset value
        const valueClone = originalAsset.value
            ? JSON.parse(JSON.stringify(originalAsset.value))
            : originalAsset.value;

        const newId = this.createSmart({
            value: valueClone,
            valueType: originalAsset.valueType,
            node: node.type,
            name: `${originalAsset.sys.name} (Copy)`,
            position: position || { x: node.position.x + 20, y: node.position.y + 20 },
            config: originalAsset.config,
            style: node.style,
        });

        if (newId) {
            this.engine.deselectAll();
            this.engine.setNodes(this.engine.state.nodes.map(n =>
                n.id === newId ? { ...n, selected: true } : n
            ));
        }
    }

    public pasteNodes(copiedNodes: SynniaNode[]) {
        const { assets } = this.engine.state;
        const newIds: string[] = [];

        for (const node of copiedNodes) {
            const assetId = resolveNodeAssetId(node);
            const originalAsset = assetId ? assets[assetId] : null;

            let newId: string | undefined;

            if (originalAsset) {
                // Clone asset value
                const valueClone = originalAsset.value
                    ? JSON.parse(JSON.stringify(originalAsset.value))
                    : originalAsset.value;

                newId = this.createSmart({
                    value: valueClone,
                    valueType: originalAsset.valueType,
                    node: node.type,
                    name: `${originalAsset.sys.name} (Copy)`,
                    position: { x: node.position.x + 50, y: node.position.y + 50 },
                    config: originalAsset.config,
                    style: node.style,
                });
            } else {
                // No asset, create with fallback
                newId = this.createSmart({
                    value: { content: 'Content unavailable (Source asset missing)' },
                    node: node.type,
                    name: 'Missing Asset',
                    position: { x: node.position.x + 50, y: node.position.y + 50 },
                    style: node.style,
                });
            }

            if (newId) newIds.push(newId);
        }

        // Select all pasted nodes
        this.engine.deselectAll();
        this.engine.setNodes(this.engine.state.nodes.map(n =>
            newIds.includes(n.id) ? { ...n, selected: true } : n
        ));
    }


    // ========================================================================
    // Smart Node Creation API (TEP Crystallized)
    // ========================================================================

    /**
     * Create a node using the unified Smart API.
     * Either `assetId` (reuse) or `value` (create new) must be provided.
     * All other fields are inferred or use sensible defaults.
     *
     * @returns The created node ID
     */
    public createSmart(spec: SmartNodeSpec): string {
        const { nodes } = this.engine.state;

        // ─────────────────────────────────────────────────────────────────────
        // Step 1: Validate input - require assetId, value, OR schema
        // ─────────────────────────────────────────────────────────────────────
        if (spec.assetId === undefined && spec.value === undefined && spec.schema === undefined) {
            throw new Error('[createSmart] Either assetId, value, or schema must be provided');
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 2: Resolve/Infer all spec fields
        // ─────────────────────────────────────────────────────────────────────
        // Determine if this is an empty node creation (schema-only)
        const isEmptyCreate = spec.assetId === undefined && spec.value === undefined;
        const valueType = spec.valueType ?? (isEmptyCreate ? 'record' : inferValueType(spec.value));
        const schema = spec.schema ?? (spec.value !== undefined ? inferSchema(spec.value) : []);

        // Resolve node type (supports aliases for backwards compatibility)
        let nodeType = spec.node ?? valueTypeToNode(valueType);
        const def = nodeRegistry.get(nodeType) || nodeRegistry.getByAlias(nodeType);
        if (def) {
            nodeType = def.type; // Use the actual registered type
        }

        const name = spec.name ?? `${nodeRegistry.getMeta(nodeType)?.title || nodeType}`;

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: Calculate position
        // ─────────────────────────────────────────────────────────────────────
        let position: XYPosition = { x: 100, y: 100 };

        if (spec.position && spec.position !== 'auto') {
            position = spec.position;
        } else if (spec.anchor) {
            const anchorNode = nodes.find(n => n.id === spec.anchor);
            if (anchorNode) {
                const offset = spec.offset ?? 'below';
                if (offset === 'below') {
                    position = {
                        x: anchorNode.position.x,
                        y: anchorNode.position.y + (anchorNode.measured?.height || 200) + 50,
                    };
                } else if (offset === 'right') {
                    position = {
                        x: anchorNode.position.x + (anchorNode.measured?.width || 250) + 50,
                        y: anchorNode.position.y,
                    };
                } else {
                    // XYPosition offset
                    position = {
                        x: anchorNode.position.x + offset.x,
                        y: anchorNode.position.y + offset.y,
                    };
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 4: Get or Create Asset
        // ─────────────────────────────────────────────────────────────────────
        const nodeId = uuidv4();
        let assetId = spec.assetId ?? nodeId;

        if (!assetId) {
            // Get node definition for create factory
            const def = nodeRegistry.get(nodeType) || nodeRegistry.getByAlias(nodeType);
            let createResult: any = null;

            // Use create factory if available
            if (def?.create) {
                createResult = def.create({ data: spec.value, schema });
            }

            // Build asset config
            const assetConfig = {
                schema,
                ...(spec.config || {}),
                ...(createResult?.asset?.config || {}),
            };

            // Determine value to store (empty object for schema-only creation)
            const assetValue = createResult?.asset?.value ?? spec.value ?? (valueType === 'array' ? [] : {});

            // Use valueType from createResult if provided (node definition knows best)
            const finalValueType = createResult?.asset?.valueType ?? valueType;

            // Create asset
            assetId = this.engine.assets.create(
                finalValueType,
                assetValue,
                {
                    id: assetId,
                    name,
                    config: assetConfig,
                    sys: createResult?.asset?.sys,
                }
            );
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 5: Create Node
        // ─────────────────────────────────────────────────────────────────────
        const meta = nodeRegistry.getMeta(nodeType);

        const newNode: SynniaNode = {
            id: nodeId,
            type: nodeType,
            position,
            data: {
                title: name,
                state: 'idle',
                assetId,
                collapsed: spec.collapsed ?? false,
                ...(spec.dockedTo ? { dockedTo: spec.dockedTo } : {}),
                ...(spec.mode === 'reference' ? { isReference: true, originalNodeId: spec.referenceOf } : {}),
            },
            style: {
                ...(meta?.style || {}),
                ...(spec.style || {}),
            },
        };

        createNodeUseCase({
            legacyNode: newNode,
            assetId,
            fileIds: spec.fileIds,
        }, {
            getNodes: () => this.engine.state.nodes,
            setNodes: (updated) => this.engine.setNodes(updated),
            getAssets: () => this.engine.state.assets,
            setAssets: (updated) => this.engine.assets.setAssets(updated),
        });

        // ─────────────────────────────────────────────────────────────────────
        // Step 6: Create connections if specified
        // ─────────────────────────────────────────────────────────────────────
        if (spec.outputEdgeFrom) {
            this.engine.updateNode(newNode.id, {
                data: { hasProductHandle: true }
            });

            this.engine.connectOutputEdge({
                source: spec.outputEdgeFrom,
                sourceHandle: 'product',
                target: newNode.id,
                targetHandle: 'origin',
            });
        }

        if (spec.connectFrom) {
            this.engine.updateNode(newNode.id, {
                data: { hasProductHandle: true }
            });

            this.engine.connectOutputEdge({
                source: spec.connectFrom.nodeId,
                sourceHandle: spec.connectFrom.handle,
                target: newNode.id,
                targetHandle: 'origin',
            });
        }

        return newNode.id;
    }

    /**
     * Create multiple nodes in batch.
     * Handles docking chain automatically when specs don't specify position.
     *
     * @returns Array of created node IDs
     */
    public createSmartBatch(specs: SmartNodeSpec[]): string[] {
        const nodeIds: string[] = [];
        let prevNodeId: string | null = null;

        for (let i = 0; i < specs.length; i++) {
            const spec = { ...specs[i] };

            // Auto-dock to previous node if no position specified
            if (i > 0 && !spec.position && !spec.anchor && prevNodeId) {
                spec.anchor = prevNodeId;
                spec.offset = 'below';
                spec.dockedTo = prevNodeId;
            }

            const nodeId = this.createSmart(spec);
            nodeIds.push(nodeId);
            prevNodeId = nodeId;
        }

        // Fix docking layout
        const updatedNodes = this.engine.layout.fixDockingLayout(this.engine.state.nodes);
        this.engine.setNodes(updatedNodes);

        return nodeIds;
    }
}
