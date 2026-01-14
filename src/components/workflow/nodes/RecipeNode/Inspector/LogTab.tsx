/**
 * LogTab - Execution history and logs viewer
 *
 * Displays execution runs for a Recipe node with expandable log entries.
 * TEP #001: Data from operational layer (SQLite), not from Asset.
 */

import { useState } from 'react';
import { useRecipeLogs, ExecutionRun, LogEntry } from '@/hooks/useRecipeLogs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ChevronDown,
    ChevronRight,
    CheckCircle,
    XCircle,
    Loader2,
    Trash2,
    Clock,
    Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LogTabProps {
    nodeId?: string;
}

export function LogTab({ nodeId }: LogTabProps) {
    const { t } = useTranslation('recipe');
    const { runs, isLoading, clearLogs, getLogEntries } = useRecipeLogs(nodeId);
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [entries, setEntries] = useState<Record<string, LogEntry[]>>({});
    const [loadingEntries, setLoadingEntries] = useState<string | null>(null);

    const toggleRun = async (runId: string) => {
        if (expandedRunId === runId) {
            setExpandedRunId(null);
            return;
        }

        setExpandedRunId(runId);

        // Load entries if not already loaded
        if (!entries[runId]) {
            setLoadingEntries(runId);
            try {
                const loadedEntries = await getLogEntries(runId);
                setEntries((prev) => ({ ...prev, [runId]: loadedEntries }));
            } finally {
                setLoadingEntries(null);
            }
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const getStatusIcon = (status: ExecutionRun['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'running':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        }
    };

    const getLevelColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'error':
                return 'text-red-500';
            case 'warn':
                return 'text-yellow-500';
            case 'info':
                return 'text-blue-500';
            case 'debug':
                return 'text-gray-400';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('log.noHistory')}</p>
                <p className="text-xs">{t('log.runToSee')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-2 border-b flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {t('log.executions', { count: runs.length })}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => clearLogs()}
                >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t('log.clear')}
                </Button>
            </div>

            {/* Run List */}
            <div className="flex-1 overflow-y-auto">
                {runs.map((run) => (
                    <div key={run.id} className="border-b">
                        {/* Run Header */}
                        <button
                            className="w-full px-4 py-2 flex items-center gap-2 hover:bg-muted/50 text-left"
                            onClick={() => toggleRun(run.id)}
                        >
                            {expandedRunId === run.id ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}

                            {getStatusIcon(run.status)}

                            <span className="text-xs flex-1">{formatDate(run.startedAt)}</span>

                            {run.durationMs && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    {formatDuration(run.durationMs)}
                                </span>
                            )}

                            {(run.tokenInput || run.tokenOutput) && (
                                <span className="text-xs text-muted-foreground">
                                    {(run.tokenInput || 0) + (run.tokenOutput || 0)} tokens
                                </span>
                            )}
                        </button>

                        {/* Model & Error Info */}
                        {(run.modelId || run.errorMessage) && (
                            <div className="px-4 pb-2 pl-10">
                                {run.modelId && (
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                        {run.modelId}
                                    </span>
                                )}
                                {run.errorMessage && (
                                    <p className="text-xs text-red-500 mt-1">{run.errorMessage}</p>
                                )}
                            </div>
                        )}

                        {/* Expanded Log Entries */}
                        {expandedRunId === run.id && (
                            <div className="bg-muted/30 border-t">
                                {loadingEntries === run.id ? (
                                    <div className="p-4 flex justify-center">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </div>
                                ) : entries[run.id]?.length ? (
                                    <div className="p-2 space-y-1 font-mono text-[10px]">
                                        {entries[run.id].map((entry) => (
                                            <div key={entry.id} className="flex gap-2">
                                                <span className="text-muted-foreground">
                                                    {formatTime(entry.timestamp)}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'uppercase w-10',
                                                        getLevelColor(entry.level)
                                                    )}
                                                >
                                                    [{entry.level}]
                                                </span>
                                                <span className="flex-1">{entry.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-xs text-muted-foreground text-center">
                                        {t('log.noDetailedLogs')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
