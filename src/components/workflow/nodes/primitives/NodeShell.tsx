import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface NodeShellProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  state?: 'idle' | 'running' | 'error' | 'success' | 'paused' | 'stale';
}

export const NodeShell = forwardRef<HTMLDivElement, NodeShellProps>(
  ({ className, selected, state = 'idle', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex flex-col bg-card border rounded-xl shadow-sm transition-all duration-200 antialiased transform-gpu",
          "min-w-[200px] min-h-[60px]", // Basic dimensions
          selected && "ring-2 ring-ring border-primary",
          state === 'running' && "border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]",
          state === 'error' && "border-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]",
          state === 'paused' && "border-yellow-500 border-dashed",
          state === 'stale' && "border-orange-400 opacity-80",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
NodeShell.displayName = "NodeShell";