/**
 * ExecutionRun Domain Entity
 *
 * Represents a single execution of a Recipe.
 * Used for audit logging and execution tracking.
 *
 * State Machine:
 *   [*] --> pending --> running --> success | error --> [*]
 */

export type ExecutionRunState = 'pending' | 'running' | 'success' | 'error';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    data?: Record<string, unknown>;
}

export interface ExecutionRun {
    /** Unique run identifier (UUID) */
    runId: string;

    /** Recipe being executed */
    recipeId: string;

    /** Input node that triggered the execution */
    inputNodeId: string;

    /** Output node created by execution (set on success) */
    outputNodeId?: string;

    /** Current execution state */
    state: ExecutionRunState;

    /** Timestamp when execution started */
    startedAt: number;

    /** Timestamp when execution completed */
    completedAt?: number;

    /** Duration in milliseconds */
    durationMs?: number;

    /** Error message (set on error state) */
    errorMessage?: string;

    /** Model ID used (for LLM executions) */
    modelId?: string;

    /** Token usage */
    tokenInput?: number;
    tokenOutput?: number;

    /** Log entries */
    logs: LogEntry[];
}

/**
 * Factory function to create a new ExecutionRun
 */
export function createExecutionRun(
    recipeId: string,
    inputNodeId: string,
    modelId?: string
): ExecutionRun {
    return {
        runId: crypto.randomUUID(),
        recipeId,
        inputNodeId,
        state: 'pending',
        startedAt: Date.now(),
        modelId,
        logs: [],
    };
}

/**
 * Transition to running state
 */
export function startExecutionRun(run: ExecutionRun): ExecutionRun {
    if (run.state !== 'pending') {
        throw new Error(`Cannot start run in state: ${run.state}`);
    }
    return {
        ...run,
        state: 'running',
    };
}

/**
 * Transition to success state
 */
export function completeExecutionRun(
    run: ExecutionRun,
    outputNodeId: string,
    usage?: { tokenInput?: number; tokenOutput?: number }
): ExecutionRun {
    if (run.state !== 'running') {
        throw new Error(`Cannot complete run in state: ${run.state}`);
    }
    const now = Date.now();
    return {
        ...run,
        state: 'success',
        outputNodeId,
        completedAt: now,
        durationMs: now - run.startedAt,
        tokenInput: usage?.tokenInput,
        tokenOutput: usage?.tokenOutput,
    };
}

/**
 * Transition to error state
 */
export function failExecutionRun(run: ExecutionRun, errorMessage: string): ExecutionRun {
    if (run.state !== 'running') {
        throw new Error(`Cannot fail run in state: ${run.state}`);
    }
    const now = Date.now();
    return {
        ...run,
        state: 'error',
        errorMessage,
        completedAt: now,
        durationMs: now - run.startedAt,
    };
}

/**
 * Append a log entry to the run
 */
export function appendLog(
    run: ExecutionRun,
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
): ExecutionRun {
    return {
        ...run,
        logs: [
            ...run.logs,
            {
                timestamp: Date.now(),
                level,
                message,
                data,
            },
        ],
    };
}
