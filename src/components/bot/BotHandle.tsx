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
        bg-primary text-primary-foreground
        p-2 rounded-r-md shadow-lg
        hover:bg-primary/90
        transition-colors
        z-50
        ${positionClassName || ''}
      `}
      aria-label="Toggle Bot Panel"
      type="button"
    >
      <MessageSquare className="w-5 h-5" />
    </button>
  );
}
