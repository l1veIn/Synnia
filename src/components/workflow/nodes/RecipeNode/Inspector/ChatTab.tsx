/**
 * ChatTab - Multi-turn conversation interface for Recipe nodes
 * WeChat-style input: 1 line default, expands to max 4 lines, then scroll
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/features/recipes/types';
import { ChatBoxDialog } from './ChatBoxDialog';

export interface ChatTabProps {
    messages: ChatMessage[];
    onSendMessage: (content: string) => void;
    disabled?: boolean;
}

export function ChatTab({ messages, onSendMessage, disabled = false }: ChatTabProps) {
    const [inputValue, setInputValue] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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

    const handleSend = () => {
        if (inputValue.trim() && !disabled) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-tab flex flex-col h-full">
            {/* Message List */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-3">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-xs py-8">
                            No messages yet. Run the recipe to start a conversation.
                        </div>
                    ) : (
                        messages.map((message) => (
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
                                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                            </div>
                        ))
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
                    title="Open full chat"
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>

                {/* Auto-expanding text input */}
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? "Chat disabled" : "Message..."}
                    disabled={disabled}
                    rows={1}
                    className={cn(
                        "flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        disabled && "opacity-50 cursor-not-allowed"
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
                    disabled={disabled || !inputValue.trim()}
                    size="icon"
                    className="h-8 w-8 shrink-0"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>

            {/* Full chat dialog */}
            <ChatBoxDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                messages={messages}
                onSendMessage={onSendMessage}
                disabled={disabled}
            />
        </div>
    );
}
