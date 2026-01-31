"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Minimize2, Plus, Trash2, MessageSquare, Check, X, Pencil } from "lucide-react";
import { Thread } from "./thread";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
    ThreadListPrimitive,
    ThreadListItemPrimitive,
    useAuiState,
    useAui,
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
            <div className="fixed inset-6 z-50 flex rounded-xl border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r flex flex-col bg-muted/30 shrink-0">
                    <div className="p-3 h-12 border-b flex items-center justify-between">
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
                                New Chat
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
                    {/* Header with Editable Title */}
                    <header className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                        <EditableTitle />
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
 * Editable title component for the chat header
 */
function EditableTitle() {
    const aui = useAui();
    const threadListItem = useAuiState(s => s.threadListItem);
    const title = threadListItem?.title ?? "New Chat";
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update edit value when title changes externally
    useEffect(() => {
        if (!isEditing) {
            setEditValue(title);
        }
    }, [title, isEditing]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = useCallback(() => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== title && threadListItem) {
            try {
                aui.threadListItem().rename(trimmed);
            } catch (e) {
                console.warn('[EditableTitle] Failed to rename thread:', e);
            }
        }
        setIsEditing(false);
    }, [aui, editValue, title, threadListItem]);

    const handleCancel = useCallback(() => {
        setEditValue(title);
        setIsEditing(false);
    }, [title]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    }, [handleSave, handleCancel]);

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className="flex-1 min-w-0 px-2 py-1 text-sm bg-muted rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={100}
                />
                <TooltipIconButton tooltip="Save" onClick={handleSave} className="shrink-0">
                    <Check className="size-3.5 text-green-500" />
                </TooltipIconButton>
                <TooltipIconButton tooltip="Cancel" onClick={handleCancel} className="shrink-0">
                    <X className="size-3.5 text-red-500" />
                </TooltipIconButton>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 min-w-0 group">
            <span
                className="text-sm font-medium truncate cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setIsEditing(true)}
                title={title}
            >
                {title}
            </span>
            <TooltipIconButton
                tooltip="Edit title"
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
                <Pencil className="size-3" />
            </TooltipIconButton>
        </div>
    );
}

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
