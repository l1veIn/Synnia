// Widget System - Registry
// Central registry for all widgets

import { WidgetDefinition, HandleSpec } from './types';

// ============================================================================
// Widget Registry
// ============================================================================

class WidgetRegistry {
    private widgets = new Map<string, WidgetDefinition>();

    /**
     * Register a widget definition
     */
    register(widget: WidgetDefinition): void {
        if (this.widgets.has(widget.id)) {
            console.warn(`[WidgetRegistry] Widget "${widget.id}" already registered, overwriting`);
        }
        this.widgets.set(widget.id, widget);
    }

    /**
     * Get widget by ID
     */
    get(id: string): WidgetDefinition | undefined {
        return this.widgets.get(id);
    }

    /**
     * Get all registered widgets
     */
    getAll(): WidgetDefinition[] {
        return Array.from(this.widgets.values());
    }

    /**
     * Get input handles for a widget given current value
     */
    getInputHandles(widgetId: string, value: any): HandleSpec[] {
        const widget = this.widgets.get(widgetId);
        if (widget?.getInputHandles) {
            return widget.getInputHandles(value);
        }
        return [];
    }
}

export const widgetRegistry = new WidgetRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get widget definition by ID
 */
export const getWidget = (id: string): WidgetDefinition | undefined => {
    return widgetRegistry.get(id);
};

/**
 * Get input handles for a widget
 */
export const getWidgetInputHandles = (widgetId: string, value: any): HandleSpec[] => {
    return widgetRegistry.getInputHandles(widgetId, value);
};
