import { Handle, HandleProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export const BaseHandle = forwardRef<HTMLDivElement, HandleProps>(
  ({ className, ...props }, ref) => {
    return (
      <Handle
        ref={ref}
        className={cn(
          // 基础样式
          'h-3 w-3 rounded-full border-2 border-background bg-muted-foreground transition-all duration-200',
          // 悬停样式：使用 ring 代替 scale，避免覆盖 React Flow 的 transform
          'hover:bg-primary hover:border-primary hover:ring-2 hover:ring-offset-1 hover:ring-primary/40',
          // 连线时的样式 (React Flow 会自动添加 .react-flow__handle-connecting 类)
          // 'react-flow__handle-connecting:bg-primary',
          className
        )}
        {...props}
      />
    );
  }
);

BaseHandle.displayName = 'BaseHandle';
