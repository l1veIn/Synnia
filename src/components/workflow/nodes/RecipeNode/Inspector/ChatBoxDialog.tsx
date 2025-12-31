/**
 * ChatBoxDialog - Full-screen chat dialog for Recipe nodes
 * Opens when user clicks expand button in ChatTab
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Send, MessageSquare, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/assets';

export interface ChatBoxDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    messages: ChatMessage[];
    onSendMessage: (content: string) => void;
    disabled?: boolean;
    title?: string;
}

export function ChatBoxDialog({
    open,
    onOpenChange,
    messages,
    onSendMessage,
    disabled = false,
    title = 'Chat',
}: ChatBoxDialogProps) {
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Auto-resize textarea (1-6 lines in dialog)
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        const lineHeight = 22;
        const minHeight = lineHeight;
        const maxHeight = lineHeight * 6;
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

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'user':
                return <User className="h-4 w-4" />;
            case 'assistant':
                return <Bot className="h-4 w-4" />;
            default:
                return <MessageSquare className="h-4 w-4" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                </DialogHeader>

                {/* Message List */}
                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-muted-foreground py-12">
                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p>No messages yet</p>
                                <p className="text-xs mt-1">Run the recipe to start a conversation</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        'flex gap-3',
                                        message.role === 'user' ? 'flex-row-reverse' : ''
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                    )}>
                                        {getRoleIcon(message.role)}
                                    </div>

                                    {/* Message bubble */}
                                    <div className={cn(
                                        'p-3 rounded-lg max-w-[80%]',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : message.role === 'assistant'
                                                ? 'bg-muted'
                                                : 'bg-secondary text-secondary-foreground'
                                    )}>
                                        <div className="whitespace-pre-wrap break-words text-sm">
                                            {message.content}
                                        </div>
                                        {message.timestamp && (
                                            <div className="text-[10px] opacity-50 mt-1 text-right">
                                                {new Date(message.timestamp).toLocaleTimeString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4 flex items-end gap-3 bg-background shrink-0">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={disabled ? "Chat is disabled" : "Type your message..."}
                        disabled={disabled}
                        rows={1}
                        className={cn(
                            "flex-1 resize-none rounded-lg border bg-muted/50 px-4 py-2.5 text-sm",
                            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                            minHeight: '40px',
                            maxHeight: '132px',
                            overflowY: inputValue.split('\n').length > 6 ? 'auto' : 'hidden'
                        }}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={disabled || !inputValue.trim()}
                        className="shrink-0 h-10"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        Send
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
