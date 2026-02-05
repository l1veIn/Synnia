"use client";

import { X, Plus, Maximize2 } from "lucide-react";
import { TooltipIconButton } from "./tooltip-icon-button";

interface ModalHeaderProps {
    title?: string;
    onNewChat?: () => void;
    onExpand?: () => void;
    onClose?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
}

export const ModalHeader = ({
    title = "Assistant",
    onNewChat,
    onExpand,
    onClose,
    onMouseDown,
}: ModalHeaderProps) => {
    return (
        <div
            className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 cursor-move select-none rounded-t-xl"
            onMouseDown={onMouseDown}
        >
            <span className="font-medium text-sm">{title}</span>
            <div className="flex items-center gap-0.5">
                <TooltipIconButton tooltip="New Chat" onClick={onNewChat}>
                    <Plus className="size-4" />
                </TooltipIconButton>
                <TooltipIconButton tooltip="Expand" onClick={onExpand}>
                    <Maximize2 className="size-4" />
                </TooltipIconButton>
                <TooltipIconButton tooltip="Close" onClick={onClose}>
                    <X className="size-4" />
                </TooltipIconButton>
            </div>
        </div>
    );
};
