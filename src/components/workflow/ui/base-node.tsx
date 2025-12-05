import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BaseNodeProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  state?: 'idle' | 'running' | 'paused' | 'error' | 'success';
}

export const BaseNode = forwardRef<HTMLDivElement, BaseNodeProps>(
  ({ className, selected, state = 'idle', children, ...props }, ref) => {
    
    // 根据状态决定边框颜色
    const stateStyles = {
      idle: 'border-border',
      running: 'border-primary ring-2 ring-primary/20',
      paused: 'border-yellow-500/50 bg-yellow-500/5',
      error: 'border-destructive ring-2 ring-destructive/20 bg-destructive/5',
      success: 'border-green-500 ring-2 ring-green-500/20 bg-green-500/5',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200',
          'min-w-[200px]',
          selected ? 'border-primary shadow-md ring-1 ring-primary' : '',
          stateStyles[state],
          className
        )}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);

BaseNode.displayName = 'BaseNode';
