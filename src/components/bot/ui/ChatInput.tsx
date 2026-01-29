import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Plus, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    isLoading: boolean;
    themeStyle?: React.CSSProperties;
    useCustomTheme?: boolean;
    selectedModelId: string | null;
    onModelSelect: (modelId: string) => void;
}

export function ChatInput({
    value,
    onChange,
    onSend,
    isLoading,
    themeStyle,
    useCustomTheme,
    selectedModelId,
    onModelSelect
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 40), 200); // Increased min/max height
        textarea.style.height = `${newHeight}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-xl border bg-background/50 backdrop-blur-md shadow-sm transition-all focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring overflow-hidden",
                useCustomTheme ? "" : "border-input"
            )}
            style={useCustomTheme ? { ...themeStyle, border: '1px solid transparent' } : undefined}
        >
            {/* Text Input Area - Takes full width */}
            <div className="w-full px-3 pt-3 pb-1">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask AI anything..."
                    disabled={isLoading}
                    rows={1}
                    className={cn(
                        "w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50",
                        "max-h-[200px] overflow-y-auto custom-scrollbar"
                    )}
                    style={{
                        minHeight: '24px',
                        fontFamily: 'inherit',
                        ...themeStyle
                    }}
                />
            </div>

            {/* Bottom Toolbar */}
            <div className="flex items-center justify-between px-2 pb-2 pt-1 gap-2">
                {/* Left Tools */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>

                    {/* Model Selector */}
                    <ModelSelector
                        selectedModelId={selectedModelId}
                        onModelSelect={onModelSelect}
                        disabled={isLoading}
                    />
                </div>

                {/* Right Tools */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    >
                        <Mic className="h-4 w-4" />
                    </Button>

                    <Button
                        onClick={onSend}
                        disabled={!value.trim() || isLoading}
                        size="icon"
                        className={cn(
                            "h-7 w-7 rounded-lg transition-all",
                            value.trim() ? "opacity-100 scale-100" : "opacity-50 scale-90"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Decorative gradient line at bottom if active */}
            {!useCustomTheme && (
                <div className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            )}
        </div>
    );
}
