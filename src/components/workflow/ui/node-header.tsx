import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

/* --- Header Container --- */
export interface NodeHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function NodeHeader({ className, children, ...props }: NodeHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground',
        // 拖拽句柄样式：允许在 Header 上拖动整个节点
        'drag-handle cursor-grab active:cursor-grabbing',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* --- Header Icon --- */
export function NodeHeaderIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex h-5 w-5 items-center justify-center text-foreground/70', className)}>
      <Slot>{children}</Slot>
    </div>
  );
}

/* --- Header Title --- */
export function NodeHeaderTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex-1 truncate font-semibold text-foreground', className)}>
      {children}
    </div>
  );
}

/* --- Header Actions Container --- */
export function NodeHeaderActions({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center gap-0.5 ml-auto', className)}>
      {children}
    </div>
  );
}

/* --- Header Action Button --- */
interface NodeHeaderActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export const NodeHeaderAction = React.forwardRef<HTMLButtonElement, NodeHeaderActionProps>(
  ({ className, children, label, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground',
          // 这里的 nodrag 很重要，防止点击按钮时触发节点拖拽
          'nodrag cursor-pointer',
          className
        )}
        title={label}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NodeHeaderAction.displayName = 'NodeHeaderAction';

/* --- Drag Grip (Optional) --- */
export function NodeHeaderGrip() {
  return <GripVertical className="h-4 w-4 text-muted-foreground/40" />;
}
