import type { Asset } from '@/domain/asset/types';
import type { SynniaNode } from '@/presentation/types/project';
import type { Node, NodeExecutionState } from '@/domain/node/Node';
import type { NodeMeta } from '@/domain/node/NodeMeta';
import type { NodePresentation } from '@/domain/node/NodePresentation';
import { fromLegacy, toLegacySynniaNode } from '@/application/adapters/nodeProjection';

export type UpdateNodeInput = {
    id: string;
    legacyNode?: SynniaNode;
    legacyPatch?: Partial<SynniaNode>;
    presentation?: Partial<NodePresentation>;
    execution?: { state?: NodeExecutionState; errorMessage?: string };
    meta?: Partial<NodeMeta>;
    data?: any;
    schema?: any;
    reference?: { isReference?: boolean; originalNodeId?: string };
};

export type UpdateNodeDeps = {
    getNodes: () => SynniaNode[];
    getAssets: () => Record<string, Asset>;
    now?: () => number;
};

function applyLegacyPatch(node: SynniaNode, patch: Partial<SynniaNode>): SynniaNode {
    return {
        ...node,
        ...patch,
        style: patch.style ? { ...node.style, ...patch.style } : node.style,
        data: patch.data ? { ...node.data, ...patch.data } : node.data,
    } as SynniaNode;
}

function mergePresentation(base: NodePresentation, patch: Partial<NodePresentation>): NodePresentation {
    return {
        ...base,
        ...patch,
        layout: { ...base.layout, ...patch.layout },
        expanded: { ...base.expanded, ...patch.expanded },
        size: { ...base.size, ...patch.size },
        style: { ...base.style, ...patch.style },
        visibility: { ...base.visibility, ...patch.visibility },
        ui: { ...base.ui, ...patch.ui },
    };
}

function mergeMeta(base: NodeMeta, patch?: Partial<NodeMeta>): NodeMeta {
    if (!patch) return base;
    return {
        ...base,
        ...patch,
        sys: { ...base.sys, ...patch.sys },
        valueMeta: { ...base.valueMeta, ...patch.valueMeta },
        ui: { ...base.ui, ...patch.ui },
        ext: { ...base.ext, ...patch.ext },
    };
}

function applyDomainPatch(node: Node, input: UpdateNodeInput, now?: () => number): Node {
    const updated: Node = { ...node };

    if (input.presentation) {
        updated.presentation = mergePresentation(updated.presentation, input.presentation);
    }

    if (input.execution) {
        const prevState = updated.executionState;
        const prevError = updated.errorMessage;
        if (input.execution.state !== undefined) {
            updated.executionState = input.execution.state;
        }
        if (input.execution.errorMessage !== undefined) {
            updated.errorMessage = input.execution.errorMessage;
        }
        const changed =
            input.execution.state !== undefined ||
            input.execution.errorMessage !== undefined ||
            prevState !== updated.executionState ||
            prevError !== updated.errorMessage;
        if (changed) {
            updated.stateUpdatedAt = now?.() ?? Date.now();
        }
    }

    if (input.meta) {
        updated.meta = mergeMeta(updated.meta, input.meta);
    }

    if (input.data !== undefined) {
        updated.data = input.data;
    }

    if (input.schema !== undefined) {
        updated.schema = input.schema;
    }

    if (input.reference) {
        if (input.reference.isReference !== undefined) {
            updated.isReference = input.reference.isReference;
        }
        if (input.reference.originalNodeId !== undefined) {
            updated.originalNodeId = input.reference.originalNodeId;
        }
    }

    return updated;
}

export function updateNodeUseCase(input: UpdateNodeInput, deps: UpdateNodeDeps): SynniaNode | null {
    const legacyNode = input.legacyNode ?? deps.getNodes().find(n => n.id === input.id);
    if (!legacyNode) return null;

    if (input.legacyPatch) {
        return applyLegacyPatch(legacyNode, input.legacyPatch);
    }

    const assets = deps.getAssets();
    const domainNode = fromLegacy(legacyNode, assets);
    const updatedNode = applyDomainPatch(domainNode, input, deps.now);
    return toLegacySynniaNode(updatedNode, legacyNode);
}
