import type { ExecutionContext, ExecutionResult } from '@/domain/recipe/manifest';

/**
 * ExecutorService Port
 *
 * Abstracts recipe execution (Agent, HTTP, etc.)
 * Implementation delegates to existing AgentExecutor/HttpExecutor.
 */
export interface ExecutorService {
    /**
     * Execute a recipe with the given context
     */
    execute(ctx: ExecutionContext): Promise<ExecutionResult>;
}
