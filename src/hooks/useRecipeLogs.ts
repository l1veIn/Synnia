/**
 * useRecipeLogs - Hook for managing execution logs (Operational Layer)
 *
 * Execution logs are stored in SQLite execution_runs + log_entries tables.
 * TEP #001: Asset Ontology - process data separated from business data.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkflowStore } from '@/store/workflowStore';

// Types matching Rust definitions
export interface ExecutionRun {
    id: string;
    nodeId: string;
    recipeId?: string;
    startedAt: number;
    completedAt?: number;
    status: 'running' | 'success' | 'error';
    modelId?: string;
    durationMs?: number;
    tokenInput?: number;
    tokenOutput?: number;
    errorMessage?: string;
}

export interface LogEntry {
    id: number;
    runId: string;
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    dataJson?: string;
}

export interface NewLogEntry {
    runId: string;
    timestamp: number;
    level: LogEntry['level'];
    message: string;
    dataJson?: string;
}

export interface RunUpdate {
    completedAt?: number;
    status?: ExecutionRun['status'];
    durationMs?: number;
    tokenInput?: number;
    tokenOutput?: number;
    errorMessage?: string;
}

export function useRecipeLogs(nodeId?: string) {
    const projectRoot = useWorkflowStore((s) => s.projectRoot);
    const [runs, setRuns] = useState<ExecutionRun[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch runs
    const fetchRuns = useCallback(async () => {
        if (!projectRoot || !nodeId) {
            setRuns([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await invoke<ExecutionRun[]>('get_execution_runs', {
                projectPath: projectRoot,
                nodeId,
                limit: 50,
            });
            setRuns(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setIsLoading(false);
        }
    }, [projectRoot, nodeId]);

    // Initial fetch
    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    // Get log entries for a specific run
    const getLogEntries = useCallback(
        async (runId: string): Promise<LogEntry[]> => {
            if (!projectRoot) return [];
            return invoke<LogEntry[]>('get_log_entries', {
                projectPath: projectRoot,
                runId,
            });
        },
        [projectRoot]
    );

    // Create run and return logger
    const startRun = useCallback(
        async (params: { recipeId?: string; modelId?: string }) => {
            if (!projectRoot || !nodeId) throw new Error('No project or node');

            const run: ExecutionRun = {
                id: crypto.randomUUID(),
                nodeId,
                recipeId: params.recipeId,
                startedAt: Date.now(),
                status: 'running',
                modelId: params.modelId,
            };

            await invoke('create_execution_run', {
                projectPath: projectRoot,
                run,
            });

            // Optimistic update
            setRuns((prev) => [run, ...prev]);

            // Return a logger function for this run
            const log = async (
                level: LogEntry['level'],
                message: string,
                data?: Record<string, unknown>
            ) => {
                await invoke('append_log_entry', {
                    projectPath: projectRoot,
                    entry: {
                        runId: run.id,
                        timestamp: Date.now(),
                        level,
                        message,
                        dataJson: data ? JSON.stringify(data) : undefined,
                    },
                });
            };

            const complete = async (updates: RunUpdate) => {
                await invoke('update_execution_run', {
                    projectPath: projectRoot,
                    runId: run.id,
                    updates: {
                        ...updates,
                        completedAt: Date.now(),
                        durationMs: Date.now() - run.startedAt,
                    },
                });
                // Refresh runs list
                fetchRuns();
            };

            return { run, log, complete };
        },
        [projectRoot, nodeId, fetchRuns]
    );

    // Clear logs
    const clearLogs = useCallback(async () => {
        if (!projectRoot) return;

        try {
            await invoke('clear_execution_logs', {
                projectPath: projectRoot,
                nodeId,
            });
            setRuns([]);
        } catch (e) {
            setError(String(e));
        }
    }, [projectRoot, nodeId]);

    return {
        runs,
        isLoading,
        error,
        startRun,
        getLogEntries,
        clearLogs,
        refresh: fetchRuns,
    };
}
