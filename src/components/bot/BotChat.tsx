/**
 * BotChat - Chat Interface Component
 *
 * Provides the chat UI for the AI Assistant Bot.
 * Uses the BotRuntime context for message management.
 *
 * Phase 4: Basic chat interface with message display and input
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBotRuntime } from '@/features/bot';

export function BotChat() {
    const { messages, sendMessage, isLoading } = useBotRuntime();
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Auto-resize textarea (1-4 lines)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';

        const lineHeight = 20;
        const minHeight = lineHeight;
        const maxHeight = lineHeight * 4;

        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;
    }, [inputValue]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue.trim();
        setInputValue('');
        await sendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Message List */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-3">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            <p className="mb-2">👋 Welcome to Synnia AI Assistant!</p>
                            <p className="text-xs">Ask me anything about your canvas. I can help you:</p>
                            <ul className="text-xs mt-2 space-y-1 inline-block text-left">
                                <li>• View and list all nodes</li>
                                <li>• Create new nodes</li>
                                <li>• Update existing nodes</li>
                            </ul>
                            <p className="text-xs mt-3 text-muted-foreground/70">
                                (Full AI capabilities will be available in Phase 5)
                            </p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    'p-3 rounded-lg max-w-[85%] text-sm',
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground ml-auto'
                                        : 'bg-muted'
                                )}
                            >
                                <div className="whitespace-pre-wrap break-words">
                                    {message.content}
                                </div>
                            </div>
                        ))
                    )}

                    {/* AI Typing Indicator */}
                    {isLoading && (
                        <div className="p-3 rounded-lg max-w-[85%] bg-muted text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-3 flex items-end gap-2 bg-background">
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={isLoading}
                    rows={1}
                    className={cn(
                        "flex-1 resize-none rounded-md border bg-muted/50 px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isLoading && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                        minHeight: '36px',
                        maxHeight: '80px',
                        overflowY: inputValue.split('\n').length > 4 ? 'auto' : 'hidden'
                    }}
                />

                <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}
