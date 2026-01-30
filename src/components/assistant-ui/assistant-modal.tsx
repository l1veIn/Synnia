"use client";

import { BotIcon, ChevronDownIcon } from "lucide-react";
import { type FC, forwardRef, useState, useEffect, useCallback } from "react";

import { Thread } from "@/components/assistant-ui/thread";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ModalHeader } from "@/components/assistant-ui/modal-header";

interface AssistantModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onExpand?: () => void;
}

export const AssistantModal: FC<AssistantModalProps> = ({
  isOpen: controlledOpen,
  onOpenChange,
  onExpand
}) => {
  // Support both controlled and uncontrolled modes
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setIsOpen = useCallback((open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  }, [onOpenChange]);

  const [position, setPosition] = useState({ x: 16, y: -1 }); // -1 means not initialized
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize position on first open
  useEffect(() => {
    if (isOpen && position.y === -1) {
      setPosition({ x: 16, y: window.innerHeight - size.height - 80 });
    }
  }, [isOpen, position.y, size.height]);

  // Drag logic
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, size]);

  // Resize logic
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(800, e.clientX - position.x));
      const newHeight = Math.max(400, Math.min(window.innerHeight - 100, e.clientY - position.y));
      setSize({ width: newWidth, height: newHeight });
    };
    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, position]);

  const handleNewChat = useCallback(() => {
    // TODO: Implement new chat - for now just a placeholder
    console.log("New chat requested");
  }, []);

  const handleExpand = useCallback(() => {
    setIsOpen(false);
    onExpand?.();
  }, [onExpand]);

  return (
    <>
      {/* Floating Button */}
      <div className="aui-root aui-modal-anchor fixed left-4 bottom-4 size-11 z-50">
        <AssistantModalButton
          data-state={isOpen ? "open" : "closed"}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Modal Content */}
      {isOpen && (
        <div
          className="aui-root aui-modal-content fixed z-50 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg flex flex-col"
          style={{
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
          }}
        >
          <ModalHeader
            onNewChat={handleNewChat}
            onExpand={handleExpand}
            onClose={() => setIsOpen(false)}
            onMouseDown={handleDragStart}
          />
          <div className="flex-1 overflow-hidden [&>.aui-thread-root]:bg-inherit">
            <Thread />
          </div>
          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={handleResizeStart}
          >
            <svg
              className="w-full h-full text-muted-foreground/50"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M14 14H10L14 10V14Z M14 8H6L14 0V8Z" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
};

type AssistantModalButtonProps = {
  "data-state"?: "open" | "closed";
  onClick?: () => void;
};

const AssistantModalButton = forwardRef<
  HTMLButtonElement,
  AssistantModalButtonProps
>(({ "data-state": state, onClick, ...rest }, ref) => {
  const tooltip = state === "open" ? "Close Assistant" : "Open Assistant";

  return (
    <TooltipIconButton
      variant="default"
      tooltip={tooltip}
      side="left"
      onClick={onClick}
      {...rest}
      className="aui-modal-button size-full rounded-full shadow transition-transform hover:scale-110 active:scale-90"
      ref={ref}
    >
      <BotIcon
        data-state={state}
        className="aui-modal-button-closed-icon absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0"
      />

      <ChevronDownIcon
        data-state={state}
        className="aui-modal-button-open-icon absolute size-6 transition-all data-[state=closed]:-rotate-90 data-[state=open]:rotate-0 data-[state=closed]:scale-0 data-[state=open]:scale-100"
      />
      <span className="aui-sr-only sr-only">{tooltip}</span>
    </TooltipIconButton>
  );
});

AssistantModalButton.displayName = "AssistantModalButton";
