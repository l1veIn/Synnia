/**
 * BotChat - Chat Interface Component
 *
 * Provides the chat UI for the AI Assistant Bot.
 * Uses the BotRuntime context for message management.
 * Supports theme customization via BotThemeProvider.
 * Refactored: UI/UX Pro Max upgrade (Glassmorphism, Components)
 */

import { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useBotRuntime } from '@/features/bot';
import { useBotTheme } from '@/features/bot/theme';
import { MessageBubble } from './ui/MessageBubble';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { ChatInput } from './ui/ChatInput';
import { TypingIndicator } from './ui/TypingIndicator';
import { AnimatePresence, motion } from 'framer-motion';

export function BotChat() {
    const { messages, sendMessage, isLoading, selectedModelId, setSelectedModelId } = useBotRuntime();
    const { theme, userMessageStyle, assistantMessageStyle } = useBotTheme();
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;
        const msg = inputValue;
        setInputValue('');
        await sendMessage(msg);
    };

    const handleQuickAction = (text: string) => {
        sendMessage(text);
    };

    return (
        <div className="flex flex-col h-full bg-background/30 relative overflow-hidden">
            {/* Background Gradient Mesh - Subtle */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none z-0" />

            {/* Message List */}
            <ScrollArea className="flex-1 p-4 z-10" ref={scrollRef}>
                <div className="space-y-6 pb-4">
                    {messages.length === 0 ? (
                        <WelcomeScreen onQuickAction={handleQuickAction} />
                    ) : (
                        messages.map((message, index) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <MessageBubble
                                    role={message.role}
                                    content={message.content}
                                    style={
                                        theme.useCustomColors
                                            ? message.role === 'user'
                                                ? userMessageStyle
                                                : assistantMessageStyle
                                            : undefined
                                    }
                                    customStyle={theme.useCustomColors}
                                />
                            </motion.div>
                        ))
                    )}

                    {/* AI Typing Indicator */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex justify-start"
                            >
                                <div
                                    className={cn(
                                        "bg-muted/50 rounded-2xl rounded-bl-sm px-4 py-2",
                                        theme.useCustomColors && "bg-transparent p-0"
                                    )}
                                    style={theme.useCustomColors ? assistantMessageStyle : undefined}
                                >
                                    <TypingIndicator />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div ref={bottomRef} className="h-1" />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div
                className={cn(
                    "p-4 bg-background/80 backdrop-blur-lg border-t z-20",
                    theme.useCustomColors ? "bg-transparent border-t-0 p-2" : ""
                )}
                style={theme.useCustomColors ? { padding: 'var(--bot-input-padding)' } : undefined}
            >
                <ChatInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSend={handleSend}
                    isLoading={isLoading}
                    themeStyle={theme.useCustomColors ? {
                        fontSize: 'var(--bot-input-font-size)',
                        fontFamily: 'var(--bot-font-family)'
                    } : undefined}
                    useCustomTheme={theme.useCustomColors}
                    selectedModelId={selectedModelId}
                    onModelSelect={setSelectedModelId}
                />
            </div>
        </div>
    );
}
