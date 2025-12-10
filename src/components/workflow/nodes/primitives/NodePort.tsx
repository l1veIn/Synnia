import { Handle, HandleProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

export function NodePort({ className, position, isConnectable = true, ...props }: HandleProps) {
  
  const positionClasses = {
    [Position.Top]: "-top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full",
    [Position.Bottom]: "-bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full",
    [Position.Left]: "-left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full",
    [Position.Right]: "-right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full",
  };

  return (
    <Handle
      position={position}
      isConnectable={isConnectable}
      className={cn(
        "bg-muted-foreground border border-background transition-colors hover:bg-primary z-50",
        positionClasses[position],
        !isConnectable && "opacity-30 cursor-not-allowed", // Dim and change cursor if not connectable
        className
      )}
      {...props}
    />
  );
}