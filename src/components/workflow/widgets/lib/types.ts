// Widget System - Types
// Defines the interface for autonomous widgets

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { FieldDefinition, FieldType } from '@/types/assets';
import type { FieldCapability } from '@core/engine/FieldCapability';

// ============================================================================
// Handle Specification
// ============================================================================

/**
 * Specification for an input handle that a widget needs
 * @deprecated Use FieldCapability system instead
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
 * Props for renderFieldContent - widget renders only the value content area
 * The outer row structure (handles, label) is managed by RecipeFieldRow
 */
export interface FieldContentProps extends WidgetProps {
    field: FieldDefinition;
    isConnected: boolean;
    connectedValues: Record<string, any>;  // { [handleId]: resolvedValue }
}

// ============================================================================
// Widget Metadata
// ============================================================================

/**
 * Widget metadata for SchemaBuilder and discoverability
 */
export interface WidgetMeta {
    /** Display name for the widget */
    label: string;

    /** Brief description */
    description?: string;

    /** Icon for visual identification */
    icon?: LucideIcon;

    /** Suggested output type (informational, not enforced) */
    outputType?: FieldType;

    /** Category for grouping in picker */
    category?: 'text' | 'number' | 'selection' | 'media' | 'data' | 'other';

    /** Whether this widget supports input connections (for SchemaEditor display) */
    supportsInput?: boolean;

    /** Whether this widget supports output connections (for SchemaEditor display) */
    supportsOutput?: boolean;
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
     * [Metadata] Widget info for SchemaBuilder and UI pickers
     */
    meta?: WidgetMeta;

    /**
     * [Config Schema] Fields needed to configure this widget
     * SchemaBuilder will dynamically render UI based on this schema.
     * 
     * Example for Select widget:
     * configSchema: [{ key: 'options', type: 'array', label: 'Options', widget: 'tags' }]
     */
    configSchema?: FieldDefinition[];

    /**
     * [Capability Layer] Custom field capability
     * 
     * Override default port behavior and connection resolution.
     * If not provided, defaults are derived from FieldDefinition.
     * 
     * @param field Field definition
     * @param value Current field value
     * @returns Partial capability (merged with defaults)
     */
    getCapability?: (field: FieldDefinition, value: any) => Partial<FieldCapability>;

    /**
     * [Data Layer] Declare additional input handles needed
     * 
     * @deprecated Use getCapability instead - this is currently unused
     */
    getInputHandles?: (value: any) => HandleSpec[];

    /**
     * [View Layer] Custom rendering for the right-side content area of a field row
     * If provided, RecipeFieldRow will use this instead of default value preview
     * Note: handles and label are rendered by RecipeFieldRow, not the widget
     * 
     * @param props Extended props including connection data
     * @returns JSX for the value content area only
     */
    renderFieldContent?: (props: FieldContentProps) => ReactNode;
}
