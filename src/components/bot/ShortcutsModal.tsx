import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBotStore } from '@/store/botStore';
import { Keyboard } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Cmd', 'K'], description: 'Toggle AI Assistant Panel' },
  { keys: ['Cmd', 'S'], description: 'Save Project' },
  { keys: ['Cmd', 'Z'], description: 'Undo' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Cmd', 'D'], description: 'Duplicate Selected Nodes' },
  { keys: ['Cmd', 'C'], description: 'Copy Selected Nodes' },
  { keys: ['Cmd', 'V'], description: 'Paste Nodes' },
  { keys: ['Delete', 'Backspace'], description: 'Delete Selected' },
  { keys: ['Cmd', '/'], description: 'Show Keyboard Shortcuts' },
];

function KeyBadge({ keyChar }: { keyChar: string }) {
  return (
    <kbd className="min-w-[24px] px-1.5 py-0.5 text-xs font-semibold text-foreground bg-muted border border-border rounded-md shadow-sm flex items-center justify-center">
      {keyChar}
    </kbd>
  );
}

export function ShortcutsModal() {
  const { shortcutsModalOpen, closeShortcutsModal } = useBotStore();

  return (
    <Dialog open={shortcutsModalOpen} onOpenChange={(open) => !open && closeShortcutsModal()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Quick shortcuts to speed up your workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((keyChar, keyIndex) => (
                  <div key={keyIndex} className="flex items-center gap-0.5">
                    <KeyBadge keyChar={keyChar} />
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="text-xs text-muted-foreground mx-0.5">+</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
