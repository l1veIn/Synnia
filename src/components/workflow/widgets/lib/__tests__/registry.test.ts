// Widget Registry Tests
// Tests for widget registration and retrieval using exported functions

import { describe, it, expect } from 'vitest';
import { widgetRegistry, getWidget, getWidgetInputHandles } from '../registry';
import { WidgetDefinition } from '../types';

describe('widgetRegistry', () => {
    // Note: Using the singleton instance, tests may affect each other
    // For production, consider exposing a reset method or factory

    describe('getWidget', () => {
        it('should return undefined for unknown widget', () => {
            expect(getWidget('nonexistent-widget-xyz')).toBeUndefined();
        });

        it('should return registered widget', () => {
            // Register a test widget
            const testWidget: WidgetDefinition = {
                id: 'test-get-widget',
                render: () => null,
            };
            widgetRegistry.register(testWidget);

            // Should find it
            expect(getWidget('test-get-widget')).toBe(testWidget);
        });
    });

    describe('getWidgetInputHandles', () => {
        it('should return empty array for unknown widget', () => {
            expect(getWidgetInputHandles('unknown-handle-widget', {})).toEqual([]);
        });

        it('should return empty array when widget has no getInputHandles', () => {
            const widget: WidgetDefinition = {
                id: 'test-no-handles',
                render: () => null,
            };
            widgetRegistry.register(widget);

            expect(getWidgetInputHandles('test-no-handles', {})).toEqual([]);
        });

        it('should call widget getInputHandles with value and return result', () => {
            const mockHandles = [{ id: 'handle1', dataType: 'image', label: 'Image' }];
            const widget: WidgetDefinition = {
                id: 'test-with-handles',
                render: () => null,
                getInputHandles: (value) => {
                    return value?.enabled ? mockHandles : [];
                },
            };
            widgetRegistry.register(widget);

            expect(getWidgetInputHandles('test-with-handles', { enabled: false })).toEqual([]);
            expect(getWidgetInputHandles('test-with-handles', { enabled: true })).toEqual(mockHandles);
        });
    });

    describe('widgetRegistry.getAll', () => {
        it('should return array of widgets', () => {
            // Register a test widget
            widgetRegistry.register({
                id: 'test-get-all',
                render: () => null,
            });

            const all = widgetRegistry.getAll();
            expect(Array.isArray(all)).toBe(true);
            expect(all.some(w => w.id === 'test-get-all')).toBe(true);
        });
    });
});
