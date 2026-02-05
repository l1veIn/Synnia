/**
 * ExecutorAdapter
 *
 * Implements ExecutorService port by delegating to
 * the existing executorRegistry (AgentExecutor/HttpExecutor).
 */

import type { ExecutorService } from '@/application/ports/ExecutorService';
import type { ExecutionContext, ExecutionResult } from '@/domain/recipe/manifest';
import { getExecutorForManifest } from '@/infrastructure/executors';
import { graphEngine } from '@/presentation/engine/GraphEngine';

export class ExecutorAdapter implements ExecutorService {
    async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
        const executor = getExecutorForManifest(ctx.manifest);

        if (!executor) {
            return {
                success: false,
                error: `No executor found for manifest type: ${ctx.manifest.executor?.type}`,
            };
        }

        // Inject graphEngine into context
        const fullCtx: ExecutionContext = {
            ...ctx,
            engine: graphEngine,
        };

        return executor.execute(fullCtx);
    }
}

// Singleton instance
export const executorAdapter = new ExecutorAdapter();
