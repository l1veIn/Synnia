import { useBotStore } from '@/store/botStore';
import { MessageSquare, X, HelpCircle } from 'lucide-react';
import { BotChat } from './BotChat';
import { BotHandle } from './BotHandle';
import { ConfirmDialog } from './ConfirmDialog';
import { ShortcutsModal } from './ShortcutsModal';
import { BotRuntimeProvider } from '@/features/bot';

/**
 * BotPanel - Left-side collapsible panel for AI Assistant
 *
 * When closed: Shows BotHandle (icon button on left edge)
 * When open: Slides in from left with 400px width
 *
 * Wraps the chat interface with BotRuntimeProvider for state management.
 */
export function BotPanel() {
  const { isPanelOpen, closePanel, openShortcutsModal } = useBotStore();

  // When closed, only show the handle
  if (!isPanelOpen) {
    return <BotHandle />;
  }

  return (
    <>
      <BotRuntimeProvider>
        {/* Panel */}
        <aside
          className="
            fixed left-0 top-0 h-full w-[400px]
            bg-background border-r shadow-lg
            flex flex-col
            transform transition-transform duration-300 ease-in-out
            z-40
            translate-x-0
          "
          data-testid="bot-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">AI Assistant</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openShortcutsModal}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Keyboard Shortcuts"
                title="Keyboard Shortcuts (Cmd+/)"
                type="button"
              >
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={closePanel}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Close Bot Panel"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-hidden">
            <BotChat />
          </div>
        </aside>

        {/* Handle (visible on the edge for quick access) */}
        <div className="absolute left-[400px] top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={closePanel}
            className="
              bg-primary text-primary-foreground
              p-2 rounded-r-md shadow-lg
              hover:bg-primary/90
              transition-colors
            "
            aria-label="Close Bot Panel"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Confirmation Dialog for dangerous operations */}
        <ConfirmDialog />
      </BotRuntimeProvider>

      {/* Shortcuts Modal (rendered outside BotRuntimeProvider) */}
      <ShortcutsModal />
    </>
  );
}
