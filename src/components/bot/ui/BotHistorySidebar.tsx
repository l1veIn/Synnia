
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, X, Calendar, Clock, ChevronUp } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBotRuntime } from '@/features/bot/BotRuntime';
import { useBotTheme } from '@/features/bot/theme';
import type { BotSessionMeta } from '@/features/bot/persistence';

interface BotHistorySidebarProps {
    open: boolean;
    onClose: () => void;
}

export function BotHistorySidebar({ open, onClose }: BotHistorySidebarProps) {
    const { listSessions, createNewSession, loadSession, deleteSession, sessionId: currentSessionId } = useBotRuntime();
    const { theme } = useBotTheme();

    const [sessions, setSessions] = useState<BotSessionMeta[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Load sessions when opened
    useEffect(() => {
        if (open) {
            loadHistory();
        }
    }, [open]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await listSessions();
            // Sort by updatedAt descending
            setSessions(data.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = async () => {
        await createNewSession();
        onClose();
    };

    const handleSelectSession = async (id: string) => {
        if (id === currentSessionId) {
            onClose();
            return;
        }
        await loadSession(id);
        onClose();
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            await deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Failed to delete session:', error);
        } finally {
            setDeletingId(null);
        }
    };

    // Group sessions
    const groupedSessions = useMemo(() => {
        const groups: Record<string, BotSessionMeta[]> = {
            'Today': [],
            'Yesterday': [],
            'Previous 30 Days': [],
            'Older': []
        };

        sessions.forEach(session => {
            const date = new Date(session.updatedAt);
            if (isToday(date)) {
                groups['Today'].push(session);
            } else if (isYesterday(date)) {
                groups['Yesterday'].push(session);
            } else {
                const daysDiff = (Date.now() - session.updatedAt) / (1000 * 60 * 60 * 24);
                if (daysDiff <= 30) {
                    groups['Previous 30 Days'].push(session);
                } else {
                    groups['Older'].push(session);
                }
            }
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [sessions]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/50 backdrop-blur-sm z-30"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ y: '-100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '-100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={cn(
                            "absolute top-0 left-0 right-0 h-[450px] border-b z-40 flex flex-col shadow-2xl",
                            "bg-background/95 backdrop-blur-xl", // Default matching theme
                            theme.useCustomColors && "bg-background/90" // Custom theme override
                        )}
                        style={theme.useCustomColors ? {
                            backgroundColor: 'bg-background/95' // Fallback to standard
                        } : undefined}
                    >
                        {/* Header */}
                        <div className="p-3 border-b flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleNewChat}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 shadow-sm"
                                    style={theme.useCustomColors ? {
                                        borderColor: 'var(--bot-border)',
                                        color: 'var(--bot-primary)'
                                    } : undefined}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New Chat
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                onClick={onClose}
                            >
                                Collapse
                                <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        {/* Session List */}
                        <ScrollArea className="flex-1 px-3">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                                    <span className="text-xs">Loading history...</span>
                                </div>
                            ) : sessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center px-4">
                                    <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No history yet</p>
                                    <p className="text-xs opacity-70 mt-1">Start a conversation to see it here.</p>
                                </div>
                            ) : (
                                <div className="pb-4 space-y-6">
                                    {groupedSessions.map(([group, groupSessions]) => (
                                        <div key={group}>
                                            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                                                {group}
                                            </h3>
                                            <div className="space-y-0.5">
                                                {groupSessions.map((session) => (
                                                    <div
                                                        key={session.id}
                                                        onClick={() => handleSelectSession(session.id)}
                                                        className={cn(
                                                            "group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer text-sm transition-all",
                                                            session.id === currentSessionId
                                                                ? "bg-accent text-accent-foreground font-medium"
                                                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                            <span className="truncate block">
                                                                {session.messageCount > 0
                                                                    ? `Conversation ${format(session.createdAt, 'HH:mm')}` // Fallback title
                                                                    : 'Empty Chat'}
                                                            </span>
                                                            <span className="text-[10px] opacity-60 flex items-center gap-1">
                                                                <span className="w-1 h-1 rounded-full bg-primary/40" />
                                                                {format(session.updatedAt, 'MMM d, HH:mm')}
                                                                {session.messageCount > 0 && ` • ${session.messageCount} msgs`}
                                                            </span>
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn(
                                                                "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0",
                                                                deletingId === session.id && "opacity-100 animate-pulse text-destructive"
                                                            )}
                                                            onClick={(e) => handleDeleteSession(e, session.id)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer Info */}
                        <div className="p-3 border-t text-[10px] text-muted-foreground text-center bg-muted/20">
                            {sessions.length} conversations stored
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
