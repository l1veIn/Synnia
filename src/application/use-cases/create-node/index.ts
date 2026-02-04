import type { Asset } from '@/types/assets';
import type { SynniaNode } from '@/types/project';
import type { Node, NodeExecutionState, NodeValueType } from '@/domain/node/Node';
import type { NodeMeta } from '@/domain/node/NodeMeta';
import type { NodePresentation } from '@/domain/node/NodePresentation';
import type { NodeSchema } from '@/domain/node/NodeSchema';
import { fromLegacy, toLegacyAsset, toLegacySynniaNode } from '@/application/adapters/nodeProjection';

export type CreateNodeInput = {
    id?: string;
    type?: string;  // Required unless legacyNode is provided
    data?: any;
    schema?: NodeSchema;
    valueType?: NodeValueType;
    meta?: Partial<NodeMeta>;
    presentation?: Partial<NodePresentation>;
    execution?: { state?: NodeExecutionState; errorMessage?: string };
    reference?: { isReference?: boolean; originalNodeId?: string };
    assetId?: string;
    fileIds?: string[];  // References to File aggregates
    legacyNode?: SynniaNode;
};

export type CreateNodeDeps = {
    getNodes: () => SynniaNode[];
    setNodes: (nodes: SynniaNode[]) => void;
    getAssets: () => Record<string, Asset>;
    setAssets: (assets: Record<string, Asset>) => void;
    now?: () => number;
};

function buildDefaultPresentation(presentation?: Partial<NodePresentation>): NodePresentation {
    return {
        position: presentation?.position ?? { x: 0, y: 0 },
        size: presentation?.size,
        style: presentation?.style,
        layout: presentation?.layout,
        expanded: presentation?.expanded ?? { collapsed: false },
        visibility: presentation?.visibility,
        ui: presentation?.ui,
    };
}

function buildDefaultMeta(name: string, meta?: Partial<NodeMeta>, now?: () => number): NodeMeta {
    const timestamp = now?.() ?? Date.now();
    return {
        sys: {
            name,
            createdAt: meta?.sys?.createdAt ?? timestamp,
            updatedAt: meta?.sys?.updatedAt ?? timestamp,
            source: meta?.sys?.source ?? 'user',
            isLibraryAsset: meta?.sys?.isLibraryAsset ?? null,
        },
        valueMeta: meta?.valueMeta,
        ui: meta?.ui,
        ext: meta?.ext,
    };
}

export function createNodeUseCase(input: CreateNodeInput, deps: CreateNodeDeps): Node {
    const assets = deps.getAssets();

    if (input.legacyNode) {
        const domainNode = fromLegacy(input.legacyNode, assets);
        if (input.assetId) {
            domainNode.meta.ext = { ...(domainNode.meta.ext || {}), assetId: input.assetId };
        }
        // Write fileIds to domain node
        if (input.fileIds && input.fileIds.length > 0) {
            domainNode.fileIds = input.fileIds;
        }
        const legacyNode = toLegacySynniaNode(domainNode, input.legacyNode);
        deps.setNodes([...deps.getNodes(), legacyNode]);

        const assetId = (domainNode.meta.ext?.assetId as string | undefined) ?? legacyNode.data?.assetId ?? legacyNode.id;
        if (!assets[assetId]) {
            deps.setAssets({ ...assets, [assetId]: toLegacyAsset(domainNode) });
        }
        return domainNode;
    }

    const name = input.meta?.sys?.name || 'Untitled';
    const meta = buildDefaultMeta(name, input.meta, deps.now);
    if (input.assetId) {
        meta.ext = { ...(meta.ext || {}), assetId: input.assetId };
    }

    const node: Node = {
        id: input.id || crypto.randomUUID(),
        type: input.type ?? 'form',  // Default to 'form' if not provided
        valueType: input.valueType ?? 'record',
        data: input.data ?? (input.valueType === 'array' ? [] : {}),
        schema: input.schema,
        meta,
        presentation: buildDefaultPresentation(input.presentation),
        fileIds: input.fileIds,  // Write fileIds to node
        executionState: input.execution?.state,
        errorMessage: input.execution?.errorMessage,
        stateUpdatedAt: input.execution?.state ? (deps.now?.() ?? Date.now()) : undefined,
        isReference: input.reference?.isReference,
        originalNodeId: input.reference?.originalNodeId,
    };

    const legacyNode = toLegacySynniaNode(node);
    deps.setNodes([...deps.getNodes(), legacyNode]);

    const assetId = (node.meta.ext?.assetId as string | undefined) ?? legacyNode.data?.assetId ?? legacyNode.id;
    if (!assets[assetId]) {
        deps.setAssets({ ...assets, [assetId]: toLegacyAsset(node) });
    }

    return node;
}
