/**
 * ExecutionLoggerAdapter
 *
 * Implements ExecutionLoggerPort using Tauri invoke commands.
 * Extracted from useRunRecipe's createExecutionLogger.
 */

import type { ExecutionLogger, ExecutionLoggerPort } from '@/application/ports/ExecutionLoggerPort';
import type { LogLevel } from '@/domain/recipe/ExecutionRun';
import { invoke } from '@tauri-apps/api/core';

export class ExecutionLoggerAdapter implements ExecutionLoggerPort {
    constructor(private getProjectRoot: () => string | null) { }

    async create(
        nodeId: string,
        recipeId: string,
        modelId?: string
    ): Promise<ExecutionLogger | null> {
        const projectRoot = this.getProjectRoot();
        if (!projectRoot) return null;

        const runId = crypto.randomUUID();
        const startedAt = Date.now();

        try {
            await invoke('create_execution_run', {
                projectPath: projectRoot,
                run: {
                    id: runId,
                    nodeId,
                    recipeId,
                    startedAt,
                    status: 'running',
                    modelId,
                },
            });
        } catch (e) {
            console.warn('[ExecutionLoggerAdapter] Failed to create run:', e);
            return null;
        }

        return {
            log: async (level: LogLevel, message: string, data?: Record<string, unknown>) => {
                try {
                    await invoke('append_log_entry', {
                        projectPath: projectRoot,
                        entry: {
                            runId,
                            timestamp: Date.now(),
                            level,
                            message,
                            dataJson: data ? JSON.stringify(data) : undefined,
                        },
                    });
                } catch (e) {
                    console.warn('[ExecutionLoggerAdapter] Failed to append entry:', e);
                }
            },
            complete: async (
                status: 'success' | 'error',
                summary?: {
                    tokenInput?: number;
                    tokenOutput?: number;
                    errorMessage?: string;
                }
            ) => {
                try {
                    await invoke('update_execution_run', {
                        projectPath: projectRoot,
                        runId,
                        updates: {
                            completedAt: Date.now(),
                            status,
                            durationMs: Date.now() - startedAt,
                            tokenInput: summary?.tokenInput,
                            tokenOutput: summary?.tokenOutput,
                            errorMessage: summary?.errorMessage,
                        },
                    });
                } catch (e) {
                    console.warn('[ExecutionLoggerAdapter] Failed to update run:', e);
                }
            },
        };
    }
}
