"use client";

import { Minimize2, Plus, Trash2, MessageSquare } from "lucide-react";
import { Thread } from "./thread";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
    ThreadListPrimitive,
    ThreadListItemPrimitive,
} from "@assistant-ui/react";

interface AssistantFullscreenProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AssistantFullscreen = ({ isOpen, onClose }: AssistantFullscreenProps) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />

            {/* Dialog Container */}
            <div className="fixed inset-4 z-50 flex rounded-xl border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r flex flex-col bg-muted/30 shrink-0">
                    <div className="p-3 border-b flex items-center justify-between">
                        <span className="font-semibold text-sm">Assistant</span>
                    </div>

                    {/* Thread List using assistant-ui primitives */}
                    <ThreadListPrimitive.Root className="flex-1 flex flex-col overflow-hidden">
                        {/* New Thread Button */}
                        <ThreadListPrimitive.New asChild>
                            <button
                                className="m-2 p-2 flex items-center gap-2 rounded-lg border border-dashed hover:bg-muted text-sm transition-colors"
                            >
                                <Plus className="size-4" />
                                New Thread
                            </button>
                        </ThreadListPrimitive.New>

                        {/* Thread Items */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <ThreadListPrimitive.Items
                                components={{
                                    ThreadListItem: ThreadListItem,
                                }}
                            />
                        </div>
                    </ThreadListPrimitive.Root>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                        <span className="text-sm text-muted-foreground">Chat</span>
                        <TooltipIconButton tooltip="Minimize" onClick={onClose}>
                            <Minimize2 className="size-4" />
                        </TooltipIconButton>
                    </header>

                    {/* Thread (reuse) */}
                    <div className="flex-1 overflow-hidden [&>.aui-thread-root]:bg-inherit">
                        <Thread />
                    </div>
                </main>
            </div>
        </>
    );
};

/**
 * Individual thread list item component
 */
function ThreadListItem() {
    return (
        <ThreadListItemPrimitive.Root className="group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors hover:bg-muted data-[active]:bg-accent data-[active]:text-accent-foreground">
            <ThreadListItemPrimitive.Trigger className="flex items-center gap-2 truncate flex-1 min-w-0">
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate">
                    <ThreadListItemPrimitive.Title fallback="New Chat" />
                </span>
            </ThreadListItemPrimitive.Trigger>
            <ThreadListItemPrimitive.Delete asChild>
                <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Trash2 className="size-3" />
                </button>
            </ThreadListItemPrimitive.Delete>
        </ThreadListItemPrimitive.Root>
    );
}
