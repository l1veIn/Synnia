import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { Node } from '@/domain/node/Node';
import type { NodeLayoutMode, NodePresentation } from '@/domain/node/NodePresentation';
import type { NodeMeta, NodeSysMetadata, NodeValueMeta } from '@/domain/node/NodeMeta';

function fallbackSysMetadata(name: string): NodeSysMetadata {
    const now = Date.now();
    return {
        name,
        createdAt: now,
        updatedAt: now,
        source: 'user',
        isLibraryAsset: null,
    };
}

function extractValueMeta(asset?: Asset): NodeValueMeta | undefined {
    if (!asset) return undefined;
    if (asset.valueMeta) return asset.valueMeta as NodeValueMeta;
    const legacyMeta = (asset.config as any)?.meta;
    if (legacyMeta && typeof legacyMeta === 'object') {
        return {
            preview: legacyMeta.preview,
            width: legacyMeta.width,
            height: legacyMeta.height,
            length: legacyMeta.length,
        };
    }
    return undefined;
}

function buildPresentationFromLegacy(node: SynniaNode): NodePresentation {
    return {
        position: node.position ?? { x: 0, y: 0 },
        size: {
            width: node.width ?? (node.style?.width as number | undefined),
            height: node.height ?? (node.style?.height as number | undefined),
        },
        style: node.style ?? undefined,
        layout: {
            mode: node.data?.layoutMode as NodeLayoutMode | undefined,
            dockedTo: node.data?.dockedTo ?? null,
            parentId: node.parentId ?? null,
        },
        expanded: {
            collapsed: !!node.data?.collapsed,
            expandedWidth: node.data?.expandedWidth,
            expandedHeight: node.data?.expandedHeight,
            originalPosition: node.data?.originalPosition,
        },
        visibility: { hidden: node.hidden },
        ui: { hasProductHandle: node.data?.hasProductHandle },
    };
}

export function fromLegacy(node: SynniaNode, assets: Record<string, Asset>): Node {
    const assetId = (node.data?.assetId as string | undefined) ?? node.id;
    const asset = assets[assetId];
    const sys = asset?.sys
        ? ({
            name: asset.sys.name,
            createdAt: asset.sys.createdAt,
            updatedAt: asset.sys.updatedAt,
            source: asset.sys.source,
            isLibraryAsset: asset.sys.isLibraryAsset,
        } as NodeSysMetadata)
        : fallbackSysMetadata(node.data?.title || 'Untitled');

    const meta: NodeMeta = {
        sys,
        valueMeta: extractValueMeta(asset),
        ui: {
            icon: node.data?.icon,
            label: node.data?.label,
        },
        ext: { assetId },
    };

    return {
        id: node.id,
        type: node.type || 'unknown',
        valueType: asset?.valueType || 'record',
        data: asset?.value ?? {},
        schema: (asset?.config as any)?.schema,
        meta,
        presentation: buildPresentationFromLegacy(node),
        executionState: node.data?.state,
        errorMessage: node.data?.errorMessage,
        stateUpdatedAt: node.data?.stateUpdatedAt,
        isReference: node.data?.isReference,
        originalNodeId: node.data?.originalNodeId,
    };
}

function mergePresentationIntoLegacy(
    presentation: NodePresentation,
    existing?: SynniaNode
): Pick<SynniaNode, 'position' | 'width' | 'height' | 'style' | 'parentId' | 'hidden'> {
    const style = {
        ...(existing?.style || {}),
        ...(presentation.style || {}),
    } as SynniaNode['style'];

    if (presentation.size?.width !== undefined) {
        style.width = presentation.size.width as any;
    }
    if (presentation.size?.height !== undefined) {
        style.height = presentation.size.height as any;
    }

    return {
        position: presentation.position ?? existing?.position ?? { x: 0, y: 0 },
        width: presentation.size?.width ?? existing?.width,
        height: presentation.size?.height ?? existing?.height,
        style,
        parentId: presentation.layout?.parentId ?? existing?.parentId,
        hidden: presentation.visibility?.hidden ?? existing?.hidden,
    };
}

export function toLegacySynniaNode(node: Node, existing?: SynniaNode): SynniaNode {
    const assetId = (node.meta.ext?.assetId as string | undefined) ?? node.id;
    const legacyData = {
        ...(existing?.data || {}),
        title: node.meta.sys?.name ?? existing?.data?.title,
        icon: node.meta.ui?.icon ?? existing?.data?.icon,
        label: node.meta.ui?.label ?? existing?.data?.label,
        state: node.executionState ?? existing?.data?.state,
        errorMessage: node.errorMessage ?? existing?.data?.errorMessage,
        stateUpdatedAt: node.stateUpdatedAt ?? existing?.data?.stateUpdatedAt,
        collapsed: node.presentation.expanded?.collapsed ?? existing?.data?.collapsed,
        expandedWidth: node.presentation.expanded?.expandedWidth ?? existing?.data?.expandedWidth,
        expandedHeight: node.presentation.expanded?.expandedHeight ?? existing?.data?.expandedHeight,
        originalPosition: node.presentation.expanded?.originalPosition ?? existing?.data?.originalPosition,
        dockedTo: node.presentation.layout?.dockedTo ?? existing?.data?.dockedTo,
        layoutMode: node.presentation.layout?.mode ?? existing?.data?.layoutMode,
        assetId,
        isReference: node.isReference ?? existing?.data?.isReference,
        originalNodeId: node.originalNodeId ?? existing?.data?.originalNodeId,
        hasProductHandle: node.presentation.ui?.hasProductHandle ?? existing?.data?.hasProductHandle,
    };

    const presentationFields = mergePresentationIntoLegacy(node.presentation, existing);

    return {
        id: existing?.id ?? node.id,
        type: node.type,
        data: legacyData,
        ...presentationFields,
        selected: existing?.selected,
        draggable: existing?.draggable,
        selectable: existing?.selectable,
        connectable: existing?.connectable,
        measured: existing?.measured,
        dragging: existing?.dragging,
        resizing: existing?.resizing,
        focusable: existing?.focusable,
        zIndex: existing?.zIndex,
    } as SynniaNode;
}

export function toLegacyAsset(node: Node, existing?: Asset): Asset {
    const assetId = (node.meta.ext?.assetId as string | undefined) ?? node.id;
    const config = {
        ...(existing?.config || {}),
        schema: node.schema ?? (existing?.config as any)?.schema,
    } as Asset['config'];

    return {
        id: assetId,
        valueType: node.valueType as Asset['valueType'],
        value: node.data,
        valueMeta: node.meta.valueMeta as Asset['valueMeta'],
        config,
        sys: {
            name: node.meta.sys.name,
            createdAt: node.meta.sys.createdAt,
            updatedAt: node.meta.sys.updatedAt,
            source: node.meta.sys.source,
            isLibraryAsset: node.meta.sys.isLibraryAsset,
        },
    } as Asset;
}
