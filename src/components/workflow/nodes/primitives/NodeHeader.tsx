import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

interface NodeHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function NodeHeader({ 
  icon, 
  title, 
  actions, 
  className, 
  children,
  ...props 
}: NodeHeaderProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-b bg-muted/30 rounded-t-xl select-none",
        className
      )} 
      {...props}
    >
      {icon && <div className="text-muted-foreground flex-shrink-0 flex items-center">{icon}</div>}
      
      <div className="flex-1 font-medium text-xs truncate leading-none">
        {title}
      </div>

      {actions && (
        <div className="flex items-center gap-1 ml-2 nodrag">
          {actions}
        </div>
      )}
      
      {children}
    </div>
  );
}

export function NodeHeaderAction({ 
    children, 
    className, 
    onClick, 
    title,
    ...props 
}: HTMLAttributes<HTMLButtonElement> & { onClick?: (e: React.MouseEvent) => void }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                "p-1 h-6 w-6 flex items-center justify-center rounded-sm transition-colors text-muted-foreground hover:bg-background hover:text-foreground",
                className
            )}
            {...props}
        >
            {children}
        </button>
    )
}