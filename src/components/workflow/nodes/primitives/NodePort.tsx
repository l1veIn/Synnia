import { Handle, HandleProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

export function NodePort({ className, position, ...props }: HandleProps) {
  
  const positionClasses = {
    [Position.Top]: "-top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-b-none",
    [Position.Bottom]: "-bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-t-none",
    [Position.Left]: "-left-1.5 top-1/2 -translate-y-1/2 h-3 w-1.5 rounded-r-none",
    [Position.Right]: "-right-1.5 top-1/2 -translate-y-1/2 h-3 w-1.5 rounded-l-none",
  };

  return (
    <Handle
      position={position}
      className={cn(
        "bg-muted-foreground border border-background transition-colors hover:bg-primary z-50",
        positionClasses[position],
        className
      )}
      {...props}
    />
  );
}