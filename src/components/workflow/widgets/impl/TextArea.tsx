// TextArea Widget
// Multi-line text input with AI enhancement and fullscreen editor

import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { callLLM } from '@features/models';
import { SynniaEditor } from '@/components/ui/synnia-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { WidgetDefinition, WidgetProps, FieldRowProps } from '../lib/types';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';

const DEFAULT_ENHANCE_PROMPT = `You are an expert prompt engineer for AI image and video generation.
Your task is to enhance the user's prompt to be more detailed, evocative, and effective for AI generation.

Rules:
- Keep the core concept and intent of the original prompt
- Add descriptive details: lighting, style, mood, camera angle, quality keywords
- Use natural, flowing language
- Output ONLY the enhanced prompt, no explanations or meta-commentary
- Keep it concise but rich (ideally under 200 words)`;

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, onChange, disabled, field }: WidgetProps) {
    const options = (field as any)?.options || {};
    const { placeholder, showEnhance = true, enhancePrompt = DEFAULT_ENHANCE_PROMPT, showEditor = true, editorMode = 'plain' } = options;

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorValue, setEditorValue] = useState('');

    const handleEnhance = useCallback(async () => {
        if (!value?.trim() || isEnhancing) return;

        setIsEnhancing(true);
        try {
            const response = await callLLM({
                systemPrompt: enhancePrompt,
                userPrompt: `Enhance this prompt:\n\n${value}`,
                temperature: 0.7,
                maxTokens: 500,
            });

            if (response.success && response.text) {
                onChange(response.text.trim());
            }
        } catch (error) {
            console.error('[TextArea] Enhancement failed:', error);
        } finally {
            setIsEnhancing(false);
        }
    }, [value, isEnhancing, enhancePrompt, onChange]);

    const handleOpenEditor = () => {
        setEditorValue(value || '');
        setIsEditorOpen(true);
    };

    const handleEditorSave = () => {
        onChange(editorValue);
        setIsEditorOpen(false);
    };

    const isDisabled = disabled || isEnhancing;

    return (
        <>
            <div className="relative">
                <Textarea
                    className="text-xs min-h-[80px] pr-16 resize-none"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || "Enter text..."}
                    disabled={isDisabled}
                />

                <div className="absolute bottom-2 right-2 flex gap-1">
                    {/* Editor Button */}
                    {showEditor && (
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 hover:bg-muted"
                                        disabled={isDisabled}
                                        onClick={handleOpenEditor}
                                    >
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                    <p>Open Editor</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Enhance Button */}
                    {showEnhance && (
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-7 w-7",
                                            "hover:bg-primary/10 hover:text-primary",
                                            "transition-all duration-200",
                                            isEnhancing && "animate-pulse"
                                        )}
                                        disabled={isDisabled || !value?.trim()}
                                        onClick={handleEnhance}
                                    >
                                        {isEnhancing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                    <p>Enhance with AI ✨</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* Fullscreen Editor Dialog */}
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-[90vw] w-[1000px] h-[80vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
                    <DialogHeader className="px-4 py-3 border-b shrink-0 space-y-0">
                        <DialogTitle className="text-sm">Edit Content</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 p-4">
                        <SynniaEditor
                            value={editorValue}
                            onChange={setEditorValue}
                            mode={editorMode}
                            className="h-full"
                        />
                    </div>

                    <DialogFooter className="px-4 py-3 border-t shrink-0 bg-muted/30">
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsEditorOpen(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleEditorSave}>
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ============================================================================
// FieldRow Renderer (for Node Body)
// ============================================================================

function renderFieldRow({ field, value, isConnected, disabled }: FieldRowProps) {
    const conn = field.connection;
    const hasInputHandle = conn?.input === true ||
        (typeof conn?.input === 'object' && conn.input.enabled);
    const hasOutputHandle = conn?.output === true ||
        (typeof conn?.output === 'object' && conn.output.enabled);
    const isMissing = field.rules?.required && !value && !isConnected;

    // Truncate multiline text for preview
    const displayValue = value
        ? String(value).split('\n')[0].slice(0, 25) + (String(value).length > 25 ? '...' : '')
        : null;

    return (
        <div className={cn(
            "relative flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            isConnected && "border-blue-500/30 bg-blue-500/5",
            disabled && "bg-muted/30 opacity-70",
            isMissing && "border-destructive/40 bg-destructive/5"
        )}>
            {hasInputHandle && <NodePort.Input id={field.key} connected={isConnected} />}

            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <span className={cn(
                    "text-[11px] font-medium truncate max-w-[70px]",
                    isMissing ? "text-destructive" : "text-muted-foreground"
                )}>
                    {field.label || field.key}
                </span>

                <div className="flex items-center gap-1.5">
                    {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            linked
                        </span>
                    ) : displayValue ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/80 text-foreground truncate max-w-[100px]">
                            {displayValue}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">empty</span>
                    )}
                </div>
            </div>

            {hasOutputHandle && (
                <NodePort.Output id={typeof conn?.output === 'object' && conn.output.handleId ? conn.output.handleId : `field:${field.key}`} />
            )}
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const TextAreaWidget: WidgetDefinition = {
    id: 'textarea',
    render: (props) => <InspectorComponent {...props} />,
    renderFieldRow,
};

// Backward compatibility export
export { InspectorComponent as TextArea };
