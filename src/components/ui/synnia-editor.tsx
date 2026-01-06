import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Maximize2, Save, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SynniaEditorProps {
    value: string;
    onChange: (val: string) => void;
    mode: 'plain' | 'markdown' | 'json';
    readOnly?: boolean;
    title?: string;
    className?: string;
    onSave?: (val: string) => void; // Optional explicit save for fullscreen
    hideToolbar?: boolean;
    hideBorder?: boolean;
}

interface WrapperProps {
    value: string;
    onChange: (val: string) => void;
    extensions: any[];
    theme: any;
    readOnly?: boolean;
    isFull?: boolean;
    onSave?: (val: string) => void;
    onMaximize?: () => void;
    className?: string;
    hideToolbar?: boolean;
    hideBorder?: boolean;
}

// Extracted component to prevent re-mounting issues
const CodeMirrorWrapper = ({
    value,
    onChange,
    extensions,
    theme,
    readOnly,
    isFull = false,
    onSave,
    onMaximize,
    className,
    hideToolbar,
    hideBorder
}: WrapperProps) => {
    return (
        <div className={cn("relative flex flex-col min-h-0", isFull ? "h-full" : "h-full", className)}>
            {!hideToolbar && (
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                    {!isFull && onSave && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-background/50 hover:bg-background border shadow-sm backdrop-blur-sm"
                            onClick={() => onSave(value)}
                            title="Save"
                        >
                            <Save className="h-3 w-3" />
                        </Button>
                    )}
                    {!isFull && onMaximize && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-background/50 hover:bg-background border shadow-sm backdrop-blur-sm"
                            onClick={onMaximize}
                            title="Maximize"
                        >
                            <Maximize2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )}

            <CodeMirror
                value={value}
                height="100%"
                className={cn(
                    "text-xs h-full overflow-hidden",
                    !hideBorder && "border rounded-md"
                )}
                extensions={extensions}
                theme={theme}
                onChange={onChange}
                readOnly={readOnly}
                basicSetup={{
                    lineNumbers: isFull, // Only show line numbers in fullscreen
                    foldGutter: isFull,
                    highlightActiveLine: isFull,
                }}
            />
        </div>
    );
};

export const SynniaEditor = ({
    value,
    onChange,
    mode,
    readOnly,
    title = 'Editor',
    className,
    onSave,
    hideToolbar,
    hideBorder
}: SynniaEditorProps) => {
    const { theme } = useTheme();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const [showPreview, setShowPreview] = useState(true);

    // Sync local value when entering/exiting fullscreen or when prop changes
    useEffect(() => {
        if (!isFullScreen) {
            setLocalValue(value);
        }
    }, [value, isFullScreen]);

    const getExtensions = () => {
        if (mode === 'json') return [json()];
        if (mode === 'markdown') return [markdown()];
        return [];
    };

    const handleFullScreenSave = () => {
        onChange(localValue);
        onSave?.(localValue);
        setIsFullScreen(false);
    };

    const isMarkdown = mode === 'markdown';
    const enableSplit = isMarkdown && showPreview;

    return (
        <>
            <CodeMirrorWrapper
                value={value}
                onChange={onChange}
                extensions={getExtensions()}
                theme={theme === 'dark' ? oneDark : undefined}
                readOnly={readOnly}
                isFull={false}
                onSave={onSave}
                onMaximize={() => setIsFullScreen(true)}
                className={className}
                hideToolbar={hideToolbar}
                hideBorder={hideBorder}
            />

            <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
                <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
                    <DialogHeader className="px-4 py-2 border-b h-12 flex flex-row items-center justify-between shrink-0 space-y-0">
                        <DialogTitle className="text-sm">{title} ({mode})</DialogTitle>
                        <div className="hidden">
                            <p>Full screen editor for {title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {isMarkdown && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="h-7 text-xs mr-10"
                                >
                                    {showPreview ? <PanelRightClose className="h-3 w-3 mr-2" /> : <PanelRightOpen className="h-3 w-3 mr-2" />}
                                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 bg-muted/10 overflow-hidden">
                        {enableSplit ? (
                            <div className="grid grid-cols-2 h-full w-full divide-x">
                                <div className="h-full min-h-0 p-4">
                                    <CodeMirrorWrapper
                                        value={localValue}
                                        onChange={setLocalValue}
                                        extensions={getExtensions()}
                                        theme={theme === 'dark' ? oneDark : undefined}
                                        readOnly={readOnly}
                                        isFull={true}
                                    />
                                </div>
                                <div className="h-full min-h-0 overflow-y-auto bg-background p-8">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {localValue}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full w-full p-4">
                                <CodeMirrorWrapper
                                    value={localValue}
                                    onChange={setLocalValue}
                                    extensions={getExtensions()}
                                    theme={theme === 'dark' ? oneDark : undefined}
                                    readOnly={readOnly}
                                    isFull={true}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-4 py-2 border-t h-14 shrink-0 flex items-center bg-muted/30">
                        <div className="flex-1 flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                                {localValue.length} characters
                            </span>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(false)}>Close</Button>
                                <Button size="sm" onClick={handleFullScreenSave}>
                                    <Save className="h-4 w-4 mr-2" /> Save & Close
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};