import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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

    // Panel actions
    togglePanel: () => {
      const { isPanelOpen } = get();
      set({ isPanelOpen: !isPanelOpen });
    },

    openPanel: () => {
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
  }))
);
