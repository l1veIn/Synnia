// Widget System - Types
// Defines the interface for autonomous widgets

import { ReactNode } from 'react';
import { FieldDefinition } from '@/types/assets';

// ============================================================================
// Handle Specification
// ============================================================================

/**
 * Specification for an input handle that a widget needs
 */
export interface HandleSpec {
    id: string;           // Handle ID suffix, e.g. 'referenceImage'
    dataType: string;     // Data type: 'image', 'text', 'json', etc.
    label?: string;       // Display label
    required?: boolean;   // Whether this input is required
}

// ============================================================================
// Widget Props
// ============================================================================

/**
 * Base props passed to widget render function
 */
export interface WidgetProps {
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    field?: FieldDefinition;
}

/**
 * Extended props for renderFieldRow - includes connection data
 */
export interface FieldRowProps extends WidgetProps {
    field: FieldDefinition;
    isConnected: boolean;
    connectedValues: Record<string, any>;  // { [handleId]: resolvedValue }
}

// ============================================================================
// Widget Definition
// ============================================================================

/**
 * Complete Widget definition with optional autonomy features
 */
export interface WidgetDefinition {
    /**
     * Unique widget ID, matches the 'widget' field in schema
     * e.g. 'text', 'select', 'model-configurator'
     */
    id: string;

    /**
     * Render the widget control (inside FormRenderer)
     */
    render: (props: WidgetProps) => ReactNode;

    /**
     * [Data Layer] Declare additional input handles needed
     * Called by port registry to register dynamic handles
     * 
     * @param value Current field value
     * @returns Array of handle specifications
     */
    getInputHandles?: (value: any) => HandleSpec[];

    /**
     * [View Layer] Full control over FieldRow rendering
     * If provided, RecipeFieldRow will delegate to this
     * 
     * @param props Extended props including connection data
     * @returns Complete FieldRow JSX
     */
    renderFieldRow?: (props: FieldRowProps) => ReactNode;
}
