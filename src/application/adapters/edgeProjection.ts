import type { SynniaEdge } from '@/types/project';
import type { Edge } from '@/domain/edge/Edge';

function inferEdgeType(edge: SynniaEdge): Edge['type'] {
    if (edge.data?.edgeType === 'output' || edge.type === 'output') {
        return 'product';
    }
    return 'value';
}

export function fromLegacyEdge(edge: SynniaEdge): Edge {
    return {
        id: edge.id,
        type: inferEdgeType(edge),
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        mappingSpec: (edge.data as any)?.mappingSpec,
        uiType: edge.type,
    };
}

export function toLegacyEdge(edge: Edge, existing?: SynniaEdge): SynniaEdge {
    const edgeType = edge.type === 'product' ? 'output' : 'data';
    const uiType = edge.type === 'product' ? 'output' : (edge.uiType ?? existing?.type ?? 'deletable');

    return {
        id: existing?.id ?? edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle ?? existing?.sourceHandle,
        targetHandle: edge.targetHandle ?? existing?.targetHandle,
        type: uiType,
        data: {
            ...(existing?.data ?? {}),
            edgeType,
            ...(edge.mappingSpec ? { mappingSpec: edge.mappingSpec } : {}),
        },
    } as SynniaEdge;
}
