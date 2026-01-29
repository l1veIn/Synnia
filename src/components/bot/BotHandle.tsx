import { useBotStore } from '@/store/botStore';
import { MessageSquare } from 'lucide-react';

export interface BotHandleProps {
  /**
   * Position class for the handle
   * @default "fixed left-0 top-1/2 -translate-y-1/2"
   */
  positionClassName?: string;
}

/**
 * BotHandle - Collapsed state handle for Bot Panel
 * Displayed on the left side of the canvas when panel is closed
 */
export function BotHandle({ positionClassName }: BotHandleProps) {
  const { togglePanel } = useBotStore();

  return (
    <button
      onClick={togglePanel}
      className={`
        fixed left-0 top-1/2 -translate-y-1/2
        group flex items-center justify-center
        w-2 hover:w-10 h-16
        bg-background/40 hover:bg-background/80 backdrop-blur-md
        border-y border-r border-border/20 hover:border-border/50
        rounded-r-xl shadow-sm hover:shadow-lg
        transition-all duration-300 ease-out
        z-50 overflow-hidden
        ${positionClassName || ''}
      `}
      aria-label="Toggle Bot Panel"
      type="button"
    >
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
        <MessageSquare className="w-4 h-4 text-primary" />
      </div>

      {/* Idle indicator line */}
      <div className="absolute w-0.5 h-6 bg-foreground/20 rounded-full group-hover:opacity-0 transition-opacity" />
    </button>
  );
}
