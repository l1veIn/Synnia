/**
 * ChatTab - Multi-turn conversation interface for Recipe nodes
 * WeChat-style input: 1 line default, expands to max 4 lines, then scroll
 * 
 * TEP #001: Uses useChatContext to get data from operational layer (SQLite)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { ScrollArea } from '@/presentation/components/ui/scroll-area';
import { Send, Maximize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'
import { useChatContext } from '@/presentation/hooks/useChatContext';
import { useRunRecipe } from '@/presentation/hooks/useRunRecipe';
import { ChatBoxDialog } from './ChatBoxDialog';
import { useTranslation } from 'react-i18next';

export interface ChatTabProps {
    nodeId?: string;
    recipeId?: string;  // Required for multi-turn execution
    disabled?: boolean;
}

export function ChatTab({ nodeId, recipeId, disabled = false }: ChatTabProps) {
    const { t } = useTranslation('recipe');
    const { messages, isLoading, refresh } = useChatContext(nodeId);
    const { runRecipeWithChat } = useRunRecipe();
    const [inputValue, setInputValue] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change or when loading completes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Auto-resize textarea (1-4 lines)
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to auto to measure content
        textarea.style.height = 'auto';

        // Calculate line height (approx 20px per line)
        const lineHeight = 20;
        const minHeight = lineHeight; // 1 line
        const maxHeight = lineHeight * 4; // 4 lines

        // Set height clamped between min and max
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [inputValue, adjustTextareaHeight]);

    // Handle send: execute recipe with chat context
    const handleSend = async () => {
        if (!inputValue.trim() || disabled || isExecuting || !nodeId || !recipeId) return;

        const message = inputValue.trim();
        setInputValue('');
        setIsExecuting(true);

        try {
            await runRecipeWithChat(nodeId, recipeId, message);
            // Refresh messages after execution
            await refresh();
        } finally {
            setIsExecuting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Convert ChatMessage (from hook) to display format
    const displayMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        contentType: m.contentType || 'text',
        timestamp: m.timestamp,
    }));

    // Render content based on contentType
    const renderMessageContent = (content: string, contentType: string, role: string) => {
        if (contentType === 'json') {
            try {
                const data = JSON.parse(content);

                // Array: render as simple table
                if (Array.isArray(data)) {
                    if (data.length === 0) return <span className="text-muted-foreground text-xs">{t('chat.emptyArray')}</span>;
                    const keys = Object.keys(data[0] || {});
                    return (
                        <div className="text-xs overflow-x-auto">
                            <div className="text-muted-foreground mb-1">[{data.length} {t('chat.items')}]</div>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        {keys.slice(0, 3).map(k => (
                                            <th key={k} className="border border-border/50 px-1.5 py-0.5 text-left font-medium">
                                                {k}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 3).map((item, idx) => (
                                        <tr key={idx}>
                                            {keys.slice(0, 3).map(k => (
                                                <td key={k} className="border border-border/50 px-1.5 py-0.5 truncate max-w-[100px]">
                                                    {String(item[k] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 3 && (
                                <div className="text-muted-foreground mt-1">...{t('chat.andMore', { count: data.length - 3 })}</div>
                            )}
                        </div>
                    );
                }

                // Object: render as key-value list
                if (typeof data === 'object' && data !== null) {
                    const entries = Object.entries(data);
                    return (
                        <div className="text-xs space-y-0.5">
                            {entries.slice(0, 5).map(([key, value]) => (
                                <div key={key} className="flex gap-1">
                                    <span className="text-muted-foreground shrink-0">{key}:</span>
                                    <span className="truncate">{String(value)}</span>
                                </div>
                            ))}
                            {entries.length > 5 && (
                                <div className="text-muted-foreground">...{t('chat.andMoreFields', { count: entries.length - 5 })}</div>
                            )}
                        </div>
                    );
                }

                // Fallback: stringify
                return <div className="whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</div>;
            } catch {
                // JSON parse failed, render as text
                return <div className="whitespace-pre-wrap break-words">{content}</div>;
            }
        }

        // Text: render as-is
        return <div className="whitespace-pre-wrap break-words">{content}</div>;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="chat-tab flex flex-col h-full">
            {/* Message List */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-3">
                    {displayMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-xs py-8">
                            {t('chat.noMessages')}
                        </div>
                    ) : (
                        displayMessages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    'p-2.5 rounded-lg max-w-[85%] text-sm',
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground ml-auto'
                                        : message.role === 'assistant'
                                            ? 'bg-muted'
                                            : 'bg-secondary text-secondary-foreground text-xs'
                                )}
                            >
                                {renderMessageContent(message.content, message.contentType, message.role)}
                            </div>
                        ))
                    )}

                    {/* AI Typing Indicator */}
                    {isExecuting && (
                        <div className="p-2.5 rounded-lg max-w-[85%] bg-muted text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>{t('chat.aiThinking')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area - WeChat style */}
            <div className="border-t p-2 flex items-end gap-2 bg-background">
                {/* Expand to dialog button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setDialogOpen(true)}
                    title={t('chat.openFull')}
                    disabled={messages.length === 0}
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>

                {/* Auto-expanding text input */}
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        messages.length === 0
                            ? t('chat.runRecipeFirst')
                            : isExecuting
                                ? t('chat.aiThinking')
                                : t('chat.sendToContinue')
                    }
                    disabled={disabled || isExecuting || messages.length === 0}
                    rows={1}
                    className={cn(
                        "flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        (disabled || isExecuting || messages.length === 0) && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                        minHeight: '36px',
                        maxHeight: '80px',
                        overflowY: inputValue.split('\n').length > 4 ? 'auto' : 'hidden'
                    }}
                />

                {/* Send button */}
                <Button
                    onClick={handleSend}
                    disabled={disabled || !inputValue.trim() || isExecuting || messages.length === 0}
                    size="icon"
                    className="h-8 w-8 shrink-0"
                >
                    {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Full chat dialog */}
            <ChatBoxDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                messages={displayMessages}
                onSendMessage={(content) => {
                    if (nodeId && recipeId) {
                        runRecipeWithChat(nodeId, recipeId, content).then(() => refresh());
                    }
                }}
                disabled={disabled}
            />
        </div>
    );
}
