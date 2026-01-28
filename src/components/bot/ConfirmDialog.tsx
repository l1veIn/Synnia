/**
 * ConfirmDialog - Confirmation dialog for dangerous bot operations
 *
 * Used for operations like delete_nodes that require user confirmation
 * before executing. Integrates with botStore's confirmDialog state.
 *
 * Phase 7: Dangerous operation confirmation flow
 *
 * @see PRD-bot.md Phase 7
 * @see PRD-bot-examples.md
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBotStore } from '@/store/botStore';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog Component
 *
 * Displays a modal dialog for confirming dangerous operations.
 * The dialog state is managed by botStore.confirmDialog.
 *
 * Features:
 * - Warning icon to indicate danger
 * - Configurable message content
 * - Cancel (outline) and Confirm (destructive) buttons
 * - Handles both confirm and cancel callbacks
 */
export function ConfirmDialog() {
    const { confirmDialog, closeConfirmDialog } = useBotStore();
    const { open, message, onConfirm, onCancel } = confirmDialog;

    const handleConfirm = () => {
        onConfirm?.();
        // Note: onConfirm is responsible for calling closeConfirmDialog if needed
        // This allows the callback to control dialog closure timing
    };

    const handleCancel = () => {
        onCancel?.();
        closeConfirmDialog();
    };

    const handleOpenChange = (open: boolean) => {
        // Close dialog if user clicks outside or presses Escape
        if (!open) {
            handleCancel();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        <DialogTitle>Confirm Action</DialogTitle>
                    </div>
                    <DialogDescription className="whitespace-pre-wrap pt-2">
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} type="button">
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        type="button"
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
