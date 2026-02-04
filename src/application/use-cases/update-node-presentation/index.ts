import type { Asset } from '@/types/assets';
import type { SynniaNode } from '@/types/project';
import type { NodePresentation } from '@/domain/node/NodePresentation';
import { updateNodeUseCase } from '@/application/use-cases/update-node';

export type UpdateNodePresentationDeps = {
    getNodes: () => SynniaNode[];
    getAssets: () => Record<string, Asset>;
    now?: () => number;
};

export function updateNodePresentationUseCase(
    id: string,
    patch: Partial<NodePresentation>,
    deps: UpdateNodePresentationDeps
): SynniaNode | null {
    return updateNodeUseCase({ id, presentation: patch }, deps);
}
