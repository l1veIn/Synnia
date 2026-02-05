import type { LogLevel } from '@/domain/recipe/ExecutionRun';

/**
 * ExecutionLogger Port
 *
 * Abstracts execution logging to backend.
 * Implementation uses Tauri invoke commands.
 */
export interface ExecutionLogger {
    /**
     * Append a log entry
     */
    log(level: LogLevel, message: string, data?: Record<string, unknown>): Promise<void>;

    /**
     * Complete the execution run
     */
    complete(
        status: 'success' | 'error',
        summary?: {
            tokenInput?: number;
            tokenOutput?: number;
            errorMessage?: string;
        }
    ): Promise<void>;
}

export interface ExecutionLoggerPort {
    /**
     * Create a new execution logger for a run
     * Returns null if project is not loaded
     */
    create(nodeId: string, recipeId: string, modelId?: string): Promise<ExecutionLogger | null>;
}
