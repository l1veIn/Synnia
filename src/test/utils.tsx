/**
 * Test utilities for React component testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// ============================================================================
// Providers wrapper for component tests
// ============================================================================

interface WrapperProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that includes all necessary providers
 * Add providers here as needed (ThemeProvider, I18nProvider, etc.)
 */
function AllTheProviders({ children }: WrapperProps) {
    return <>{children}</>;
}

/**
 * Custom render function that wraps components with providers
 */
function customRender(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    return render(ui, { wrapper: AllTheProviders, ...options });
}

// ============================================================================
// Re-export everything from testing-library
// ============================================================================

export * from '@testing-library/react';
export { customRender as render };

// ============================================================================
// Common test helpers
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
    condition: () => boolean,
    timeout = 5000,
    interval = 50
): Promise<void> {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error('Condition not met within timeout');
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
}

/**
 * Create a mock function that resolves after a delay
 */
export function createDelayedMock<T>(value: T, delay = 100) {
    return () => new Promise<T>(resolve => setTimeout(() => resolve(value), delay));
}

/**
 * Flush all pending promises
 */
export function flushPromises(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
