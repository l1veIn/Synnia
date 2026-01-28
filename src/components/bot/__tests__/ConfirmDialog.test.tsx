/**
 * ConfirmDialog Component Tests
 * Tests for the confirmation dialog used in dangerous bot operations
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '@/components/bot/ConfirmDialog';
import { useBotStore } from '@/store/botStore';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/botStore', () => ({
    useBotStore: vi.fn(),
}));

const mockCloseConfirmDialog = vi.fn();

const mockStore = {
    isPanelOpen: false,
    confirmDialog: {
        open: false,
        message: '',
        onConfirm: null as (() => void) | null,
        onCancel: null as (() => void) | null,
    },
    closeConfirmDialog: mockCloseConfirmDialog,
    togglePanel: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    showConfirmDialog: vi.fn(),
};

vi.mocked(useBotStore).mockImplementation((selector) => {
    if (typeof selector === 'function') {
        return selector(mockStore);
    }
    return mockStore;
});

// ============================================================================
// Tests
// ============================================================================

describe('ConfirmDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset store state
        mockStore.confirmDialog = {
            open: false,
            message: '',
            onConfirm: null as (() => void) | null,
            onCancel: null as (() => void) | null,
        };
    });

    describe('rendering - dialog closed', () => {
        it('should not render dialog when open is false', () => {
            const { container } = render(<ConfirmDialog />);

            // Dialog should not be visible
            expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
        });
    });

    describe('rendering - dialog open', () => {
        it('should render dialog when open is true', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Are you sure you want to delete this node?';

            render(<ConfirmDialog />);

            // Dialog uses Radix UI Portal, so we need to use screen.getByRole
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should display the confirmation message', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete 2 nodes?';

            render(<ConfirmDialog />);

            expect(screen.getByText('Delete 2 nodes?')).toBeInTheDocument();
        });

        it('should display warning icon and title', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Confirm this action';

            render(<ConfirmDialog />);

            expect(screen.getByText('Confirm Action')).toBeInTheDocument();
            // AlertTriangle icon is present (can't easily test for icon specifically)
        });

        it('should display Cancel and Confirm buttons', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Confirm?';

            render(<ConfirmDialog />);

            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
        });

        it('should handle multi-line messages with whitespace', () => {
            const multilineMessage = `Are you sure you want to delete 2 node(s)?

Node IDs: node-1, node-2

This action cannot be undone.`;

            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = multilineMessage;

            render(<ConfirmDialog />);

            const dialogContent = screen.getByRole('dialog');
            expect(dialogContent.textContent).toContain('Node IDs: node-1, node-2');
        });
    });

    describe('interaction - cancel action', () => {
        it('should call onCancel callback when Cancel button is clicked', () => {
            const onCancelMock = vi.fn();
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onCancel = onCancelMock;

            render(<ConfirmDialog />);

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelButton);

            expect(onCancelMock).toHaveBeenCalledTimes(1);
            expect(mockCloseConfirmDialog).toHaveBeenCalledTimes(1);
        });

        it('should close dialog when onCancel is not provided', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onCancel = null as (() => void) | null;

            render(<ConfirmDialog />);

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelButton);

            expect(mockCloseConfirmDialog).toHaveBeenCalledTimes(1);
        });
    });

    describe('interaction - confirm action', () => {
        it('should call onConfirm callback when Confirm button is clicked', () => {
            const onConfirmMock = vi.fn();
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onConfirm = onConfirmMock;

            render(<ConfirmDialog />);

            const confirmButton = screen.getByRole('button', { name: 'Confirm' });
            fireEvent.click(confirmButton);

            expect(onConfirmMock).toHaveBeenCalledTimes(1);
            // Note: onConfirm is responsible for closing dialog, so closeConfirmDialog is not called here
        });

        it('should not crash when onConfirm is null', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onConfirm = null as (() => void) | null;

            render(<ConfirmDialog />);

            const confirmButton = screen.getByRole('button', { name: 'Confirm' });
            expect(() => fireEvent.click(confirmButton)).not.toThrow();
        });

        it('should handle onConfirm that closes the dialog internally', () => {
            const onConfirmMock = vi.fn(() => {
                mockStore.confirmDialog.open = false;
            });
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onConfirm = onConfirmMock;

            render(<ConfirmDialog />);

            const confirmButton = screen.getByRole('button', { name: 'Confirm' });
            fireEvent.click(confirmButton);

            expect(onConfirmMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('interaction - dialog dismissal', () => {
        it('should call closeConfirmDialog when Escape key is pressed', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';

            render(<ConfirmDialog />);

            // Press Escape key to close dialog
            fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

            // Radix UI Dialog handles Escape internally and calls onOpenChange(false)
            // which triggers our handleCancel -> closeConfirmDialog
            expect(mockCloseConfirmDialog).toHaveBeenCalled();
        });

        it('should call onCancel when dismissing dialog via Escape', () => {
            const onCancelMock = vi.fn();
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Delete?';
            mockStore.confirmDialog.onCancel = onCancelMock;

            render(<ConfirmDialog />);

            // Press Escape key
            fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

            expect(onCancelMock).toHaveBeenCalled();
            expect(mockCloseConfirmDialog).toHaveBeenCalled();
        });
    });

    describe('integration with botStore', () => {
        it('should use confirmDialog state from botStore', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Custom message from store';

            render(<ConfirmDialog />);

            expect(screen.getByText('Custom message from store')).toBeInTheDocument();
        });

        it('should react to store changes', () => {
            // Start with dialog closed
            mockStore.confirmDialog.open = false;
            const { rerender } = render(<ConfirmDialog />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            // Simulate store change - dialog opens
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Now open';

            rerender(<ConfirmDialog />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Now open')).toBeInTheDocument();
        });
    });

    describe('button variants', () => {
        it('should render Cancel button with outline variant', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Confirm?';

            render(<ConfirmDialog />);

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            // Button with outline variant has specific class
            expect(cancelButton).toHaveClass('border');
        });

        it('should render Confirm button with destructive variant', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = 'Confirm?';

            render(<ConfirmDialog />);

            const confirmButton = screen.getByRole('button', { name: 'Confirm' });
            // Button with destructive variant has specific class
            expect(confirmButton).toHaveClass('bg-destructive');
        });
    });

    describe('edge cases', () => {
        it('should handle empty message gracefully', () => {
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = '';

            render(<ConfirmDialog />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = longMessage;

            render(<ConfirmDialog />);

            const dialog = screen.getByRole('dialog');
            expect(dialog.textContent).toContain(longMessage);
        });

        it('should handle special characters in message', () => {
            const specialMessage = 'Delete <node> & "node2"?\n\nIDs: \'abc123\', \'xyz456\'';
            mockStore.confirmDialog.open = true;
            mockStore.confirmDialog.message = specialMessage;

            render(<ConfirmDialog />);

            const dialog = screen.getByRole('dialog');
            expect(dialog.textContent).toContain('node');
            expect(dialog.textContent).toContain('abc123');
        });
    });
});
