import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useWorkflowStore } from './workflowStore';

/**
 * Flag to prevent auto-closing Bot Panel when we're programmatically deselecting nodes
 * while opening the Bot Panel.
 */
let isOpeningBotPanel = false;

/**
 * ConfirmDialogState - Confirmation dialog state
 */
interface ConfirmDialogState {
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

/**
 * BotState - Bot Panel and Chat State
 */
interface BotState {
  // Panel state
  isPanelOpen: boolean;

  // Confirm dialog state
  confirmDialog: ConfirmDialogState;

  // Shortcuts modal state
  shortcutsModalOpen: boolean;
}

/**
 * BotActions - Bot actions
 */
interface BotActions {
  // Panel actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Confirm dialog actions
  showConfirmDialog: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
  closeConfirmDialog: () => void;

  // Shortcuts modal actions
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
}

export type BotStore = BotState & BotActions;

export const useBotStore = create<BotStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    isPanelOpen: false,

    confirmDialog: {
      open: false,
      message: '',
      onConfirm: null,
      onCancel: null,
    },

    shortcutsModalOpen: false,

    // Panel actions
    togglePanel: () => {
      const { isPanelOpen } = get();

      if (!isPanelOpen) {
        // Opening Bot Panel -> deselect all nodes (closes InspectorPanel)
        isOpeningBotPanel = true;
        const { nodes } = useWorkflowStore.getState();
        nodes.forEach((node) => {
          if (node.selected) {
            useWorkflowStore.setState((state) => ({
              nodes: state.nodes.map((n) =>
                n.id === node.id ? { ...n, selected: false } : n
              ),
            }));
          }
        });
        isOpeningBotPanel = false;
      }

      set({ isPanelOpen: !isPanelOpen });
    },

    openPanel: () => {
      // Set flag to prevent auto-close from node deselection
      isOpeningBotPanel = true;

      // Opening Bot Panel -> deselect all nodes (closes InspectorPanel)
      const { nodes } = useWorkflowStore.getState();
      nodes.forEach((node) => {
        if (node.selected) {
          useWorkflowStore.setState((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === node.id ? { ...n, selected: false } : n
            ),
          }));
        }
      });

      // Clear flag before opening panel
      isOpeningBotPanel = false;
      set({ isPanelOpen: true });
    },

    closePanel: () => {
      set({ isPanelOpen: false });
    },

    // Confirm dialog actions
    showConfirmDialog: (message, onConfirm, onCancel) => {
      set({
        confirmDialog: {
          open: true,
          message,
          onConfirm,
          onCancel: onCancel || null,
        },
      });
    },

    closeConfirmDialog: () => {
      set({
        confirmDialog: { open: false, message: '', onConfirm: null, onCancel: null },
      });
    },

    // Shortcuts modal actions
    openShortcutsModal: () => {
      set({ shortcutsModalOpen: true });
    },

    closeShortcutsModal: () => {
      set({ shortcutsModalOpen: false });
    },
  }))
);

/**
 * Panel Exclusivity Listener
 *
 * Watches workflowStore for node selection changes and closes Bot Panel
 * when a node is selected (InspectorPanel opens).
 */
let previousSelectedCount = 0;

useWorkflowStore.subscribe(
  (state) => state.nodes,
  (nodes) => {
    // Skip if we're in the middle of opening Bot Panel (to prevent auto-close)
    if (isOpeningBotPanel) {
      previousSelectedCount = nodes.filter((n) => n.selected).length;
      return;
    }

    const currentSelectedCount = nodes.filter((n) => n.selected).length;

    // Only close Bot Panel if:
    // 1. A node became selected (selection count increased)
    // 2. Bot Panel is currently open
    if (currentSelectedCount > previousSelectedCount) {
      const { isPanelOpen } = useBotStore.getState();
      if (isPanelOpen) {
        useBotStore.getState().closePanel();
      }
    }

    previousSelectedCount = currentSelectedCount;
  },
  {
    equalityFn: (a, b) => {
      // Custom equality: only trigger when selected state changes
      const aSelected = a.filter((n) => n.selected).length;
      const bSelected = b.filter((n) => n.selected).length;
      return aSelected === bSelected;
    },
  }
);
