import { useBotStore } from '@/store/botStore';
import { MessageSquare, X, HelpCircle, Palette, History } from 'lucide-react';
import { BotChat } from './BotChat';
import { BotHandle } from './BotHandle';
import { ConfirmDialog } from './ConfirmDialog';
import { ShortcutsModal } from './ShortcutsModal';
import { BotRuntimeProvider, BotThemeProvider, BotThemeCustomizer } from '@/features/bot';
import { BotHistorySidebar } from './ui/BotHistorySidebar';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  const [themeCustomizerOpen, setThemeCustomizerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // When closed, only show the handle
  if (!isPanelOpen) {
    return <BotHandle />;
  }

  return (
    <>
      <BotRuntimeProvider>
        <BotThemeProvider>
          {/* Panel */}
          <aside
            className="
            fixed left-0 top-9 h-[calc(100vh-2.25rem)] w-[400px]
            bg-background/90 backdrop-blur-xl border-r shadow-2xl
            flex flex-col
            transform transition-transform duration-300 ease-in-out
            z-40
            translate-x-0
          "
            data-testid="bot-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-sm">AI Assistant</h2>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setHistoryOpen(true)}
                  className={cn(
                    "p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all",
                    historyOpen && "bg-muted text-foreground"
                  )}
                  aria-label="History"
                  title="Chat History"
                  type="button"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setThemeCustomizerOpen(true)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  aria-label="Customize Theme"
                  title="Customize Theme"
                  type="button"
                >
                  <Palette className="w-4 h-4" />
                </button>
                <button
                  onClick={openShortcutsModal}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  aria-label="Keyboard Shortcuts"
                  title="Keyboard Shortcuts (Cmd+/)"
                  type="button"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={closePanel}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all ml-1"
                  aria-label="Close Bot Panel"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden relative">
              <BotHistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />
              <BotChat />
            </div>
          </aside>

          {/* Confirmation Dialog for dangerous operations */}
          <ConfirmDialog />
        </BotThemeProvider>
      </BotRuntimeProvider>

      {/* Shortcuts Modal (rendered outside BotRuntimeProvider) */}
      <ShortcutsModal />

      {/* Theme Customizer Modal (rendered outside providers) */}
      <BotThemeCustomizer open={themeCustomizerOpen} onOpenChange={setThemeCustomizerOpen} />
    </>
  );
}
