import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical, Save, AlertCircle } from 'lucide-react';
import { QueueAssetContent, QueueTask } from './index';
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { asset, setValue } = useAsset(assetId);

    // Get saved content - now from asset.value
    const savedContent: QueueAssetContent = useMemo(() => {
        const raw = (asset?.value as QueueAssetContent) || {};
        return {
            concurrency: raw.concurrency ?? 1,
            autoStart: raw.autoStart ?? false,
            retryOnError: raw.retryOnError ?? true,
            retryCount: raw.retryCount ?? 3,
            continueOnError: raw.continueOnError ?? false,
            tasks: raw.tasks ?? [],
            isRunning: raw.isRunning ?? false,
        };
    }, [asset?.value]);

    // Draft state
    const [draftConcurrency, setDraftConcurrency] = useState(1);
    const [draftAutoStart, setDraftAutoStart] = useState(false);
    const [draftRetryOnError, setDraftRetryOnError] = useState(true);
    const [draftRetryCount, setDraftRetryCount] = useState(3);
    const [draftContinueOnError, setDraftContinueOnError] = useState(false);
    const [draftTasks, setDraftTasks] = useState<QueueTask[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftConcurrency(savedContent.concurrency);
            setDraftAutoStart(savedContent.autoStart);
            setDraftRetryOnError(savedContent.retryOnError);
            setDraftRetryCount(savedContent.retryCount);
            setDraftContinueOnError(savedContent.continueOnError);
            setDraftTasks(savedContent.tasks);
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftConcurrency(savedContent.concurrency);
        setDraftAutoStart(savedContent.autoStart);
        setDraftRetryOnError(savedContent.retryOnError);
        setDraftRetryCount(savedContent.retryCount);
        setDraftContinueOnError(savedContent.continueOnError);
        setDraftTasks(savedContent.tasks);
        setIsInitialized(true);
    }, [assetId]);

    // Check for changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return draftConcurrency !== savedContent.concurrency ||
            draftAutoStart !== savedContent.autoStart ||
            draftRetryOnError !== savedContent.retryOnError ||
            draftRetryCount !== savedContent.retryCount ||
            draftContinueOnError !== savedContent.continueOnError ||
            JSON.stringify(draftTasks) !== JSON.stringify(savedContent.tasks);
    }, [draftConcurrency, draftAutoStart, draftRetryOnError, draftRetryCount, draftContinueOnError, draftTasks, savedContent, isInitialized]);

    // Save
    const handleSave = () => {
        setValue({
            ...savedContent,
            concurrency: draftConcurrency,
            autoStart: draftAutoStart,
            retryOnError: draftRetryOnError,
            retryCount: draftRetryCount,
            continueOnError: draftContinueOnError,
            tasks: draftTasks,
        });
        toast.success('Changes saved');
    };

    // Discard
    const handleDiscard = () => {
        setDraftConcurrency(savedContent.concurrency);
        setDraftAutoStart(savedContent.autoStart);
        setDraftRetryOnError(savedContent.retryOnError);
        setDraftRetryCount(savedContent.retryCount);
        setDraftContinueOnError(savedContent.continueOnError);
        setDraftTasks(savedContent.tasks);
        toast.info('Changes discarded');
    };

    // Task operations
    const addTask = () => {
        const newTask: QueueTask = {
            id: uuidv4(),
            name: `Task ${draftTasks.length + 1}`,
            status: 'pending',
        };
        setDraftTasks([...draftTasks, newTask]);
    };

    const updateTask = (taskId: string, name: string) => {
        setDraftTasks(draftTasks.map(t => t.id === taskId ? { ...t, name } : t));
    };

    const deleteTask = (taskId: string) => {
        setDraftTasks(draftTasks.filter(t => t.id !== taskId));
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    const completedCount = savedContent.tasks.filter(t => t.status === 'success').length;
    const errorCount = savedContent.tasks.filter(t => t.status === 'error').length;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Concurrency */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Concurrency</Label>
                        <span className="text-xs text-muted-foreground">{draftConcurrency}</span>
                    </div>
                    <Slider
                        value={[draftConcurrency]}
                        onValueChange={(v) => setDraftConcurrency(v[0])}
                        min={1}
                        max={5}
                        step={1}
                    />
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Auto Start</Label>
                        <Switch
                            checked={draftAutoStart}
                            onCheckedChange={setDraftAutoStart}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Retry on Error</Label>
                        <Switch
                            checked={draftRetryOnError}
                            onCheckedChange={setDraftRetryOnError}
                        />
                    </div>
                    {draftRetryOnError && (
                        <div className="flex items-center justify-between pl-4">
                            <Label className="text-xs text-muted-foreground">Retry Count</Label>
                            <Input
                                type="number"
                                value={draftRetryCount}
                                onChange={(e) => setDraftRetryCount(parseInt(e.target.value) || 1)}
                                className="h-6 w-16 text-xs"
                                min={1}
                                max={10}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Continue on Error</Label>
                        <Switch
                            checked={draftContinueOnError}
                            onCheckedChange={setDraftContinueOnError}
                        />
                    </div>
                </div>

                <div className="border-t" />

                {/* Tasks */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Tasks ({draftTasks.length})</Label>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={addTask}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    </div>

                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {draftTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center gap-2 p-1.5 rounded bg-muted/30"
                            >
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
                                <Input
                                    value={task.name}
                                    onChange={(e) => updateTask(task.id, e.target.value)}
                                    className="h-6 text-xs flex-1"
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0 hover:text-destructive"
                                    onClick={() => deleteTask(task.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}

                        {draftTasks.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-4 border rounded-md border-dashed">
                                No tasks
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="border-t pt-4">
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        <div className="p-2 rounded bg-muted/30">
                            <div className="font-medium">{savedContent.tasks.length}</div>
                            <div className="text-muted-foreground text-[10px]">Total</div>
                        </div>
                        <div className="p-2 rounded bg-green-500/10">
                            <div className="font-medium text-green-600">{completedCount}</div>
                            <div className="text-muted-foreground text-[10px]">Done</div>
                        </div>
                        <div className="p-2 rounded bg-red-500/10">
                            <div className="font-medium text-red-600">{errorCount}</div>
                            <div className="text-muted-foreground text-[10px]">Failed</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-muted-foreground font-mono">
                    {hasChanges && (
                        <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Unsaved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-7 text-xs">
                            Discard
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant={hasChanges ? "default" : "outline"}
                        onClick={handleSave}
                        className={cn("h-7 gap-1.5", hasChanges && "bg-primary")}
                        disabled={!hasChanges}
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}
