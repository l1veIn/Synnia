import type { Asset } from '@/types/assets';
import type { SynniaNode } from '@/types/project';
import type { NodeExecutionState } from '@/domain/node/Node';
import { updateNodeUseCase } from '@/application/use-cases/update-node';

export type UpdateNodeExecutionDeps = {
    getNodes: () => SynniaNode[];
    getAssets: () => Record<string, Asset>;
    now?: () => number;
};

export function updateNodeExecutionUseCase(
    id: string,
    state: NodeExecutionState,
    errorMessage: string | undefined,
    deps: UpdateNodeExecutionDeps
): SynniaNode | null {
    return updateNodeUseCase({
        id,
        execution: { state, errorMessage },
    }, deps);
}
