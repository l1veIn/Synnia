import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, Link, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { callLLM } from '@/lib/services/ai/llm';
import { SynniaEditor } from '@/components/ui/synnia-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface TextAreaProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    isConnected?: boolean;
    connectedLabel?: string;
    showEnhance?: boolean;
    enhancePrompt?: string;
    showEditor?: boolean;
    editorMode?: 'plain' | 'markdown';
    className?: string;
}

const DEFAULT_ENHANCE_PROMPT = `You are an expert prompt engineer for AI image and video generation.
Your task is to enhance the user's prompt to be more detailed, evocative, and effective for AI generation.

Rules:
- Keep the core concept and intent of the original prompt
- Add descriptive details: lighting, style, mood, camera angle, quality keywords
- Use natural, flowing language
- Output ONLY the enhanced prompt, no explanations or meta-commentary
- Keep it concise but rich (ideally under 200 words)`;

export function TextArea({
    value,
    onChange,
    disabled,
    placeholder,
    isConnected,
    connectedLabel = 'Connected',
    showEnhance = true,
    enhancePrompt = DEFAULT_ENHANCE_PROMPT,
    showEditor = true,
    editorMode = 'plain',
    className
}: TextAreaProps) {
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorValue, setEditorValue] = useState('');

    // When connected, show connected state
    if (isConnected) {
        return (
            <div className={cn(
                "flex items-center gap-2 min-h-[80px] px-3 py-2 rounded-md border border-blue-500/30 bg-blue-500/5",
                className
            )}>
                <Link className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-blue-500 font-medium">{connectedLabel}</span>
            </div>
        );
    }

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
            <div className={cn("relative", className)}>
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
