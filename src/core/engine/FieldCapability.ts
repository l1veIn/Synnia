/**
 * FieldCapability - Unified field port and connection resolution system
 * 
 * This module consolidates the implicit port rules scattered across
 * FieldDefinition, RecipeFieldRow, and Widget system into a single
 * explicit interface.
 * 
 * Key concepts:
 * - FieldCapability: Describes what a field can do (ports, resolution)
 * - ConnectionContext: All info needed to resolve a connected value
 * - getDefaultCapability: Derives capability from FieldDefinition
 */

import type { FieldDefinition } from '@/types/assets';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Port value returned by behavior.resolveOutput
 */
export interface PortValue {
    type: 'json' | 'array' | 'image' | 'text';
    value: any;
}

/**
 * Context passed to custom resolution functions
 * Contains everything needed to resolve connected values
 */
export interface ConnectionContext {
    /** The edge connecting source to target */
    edge: SynniaEdge;

    /** Source node (connected from) */
    sourceNode: SynniaNode;

    /** Source node's asset */
    sourceAsset: Asset | null;

    /** 
     * Pre-resolved output from source node via behavior.resolveOutput
     * For "reference" style widgets, this can be ignored in favor of sourceNode
     */
    sourcePortValue: PortValue | null;

    /** The field key on the target node */
    fieldKey: string;
}

/**
 * Field capability declaration
 * Controls port presence and connection resolution behavior
 */
export interface FieldCapability {
    /** Whether this field has an input port (left side) */
    hasInputPort: boolean;

    /** Whether this field has an output port (right side) */
    hasOutputPort: boolean;

    /** 
     * Port ID override (defaults to field.key)
     * Output port ID is prefixed with 'field:' automatically
     */
    portId?: string;

    /**
     * Custom resolution function for connected values
     * 
     * Default behavior: ctx.sourcePortValue?.value[fieldKey] ?? ctx.sourcePortValue?.value
     * 
     * Reference-style widgets can ignore sourcePortValue and use:
     * { nodeId: ctx.sourceNode.id, title: ctx.sourceNode.data.title, ... }
     */
    resolveConnectedValue?: (ctx: ConnectionContext) => any;
}

// ============================================================================
// Default Capability Resolution
// ============================================================================

/**
 * Semantic handles that should NOT be treated as field connections
 */
export const SEMANTIC_HANDLES = [
    'origin',
    'product',
    'output',
    'trigger',
    'array',
    'reference'
] as const;

/**
 * Derive default capability from FieldDefinition
 * 
 * This consolidates the implicit rules that were scattered in:
 * - RecipeFieldRow.tsx (hasInputHandle/hasOutputHandle logic)
 * - FieldRow.tsx (same logic duplicated)
 * 
 * Rules:
 * - connection: 'input' | 'both' -> hasInputPort
 * - connection: 'output' | 'both' -> hasOutputPort
 * - type: 'object' | 'array' -> hasInputPort (implicit, for complex data)
 */
export function getDefaultCapability(field: FieldDefinition): FieldCapability {
    const conn = field.connection;

    return {
        hasInputPort:
            conn === 'input' ||
            conn === 'both' ||
            field.type === 'object' ||
            field.type === 'array',

        hasOutputPort:
            conn === 'output' ||
            conn === 'both',

        portId: field.key,
    };
}

// ============================================================================
// Connection Resolution Utilities
// ============================================================================

/**
 * Parse field key from target handle
 * Supports both "field:xxx" format and direct field key
 */
export function parseFieldKeyFromHandle(targetHandle: string | null | undefined): string | null {
    if (!targetHandle) return null;

    // Skip semantic handles
    if (SEMANTIC_HANDLES.includes(targetHandle as any)) {
        return null;
    }

    // Extract field key from "field:xxx" format or use directly
    return targetHandle.startsWith('field:')
        ? targetHandle.slice(6)
        : targetHandle;
}

/**
 * Default resolution: extract value from sourcePortValue
 */
export function defaultResolveConnectedValue(ctx: ConnectionContext): any {
    const { sourcePortValue, fieldKey } = ctx;

    if (!sourcePortValue?.value) return undefined;

    const value = sourcePortValue.value;

    // If value is an object, try to get the specific field
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value[fieldKey] ?? value;
    }

    return value;
}

/**
 * Resolve connected value using capability
 * Falls back to default resolution if no custom resolver
 */
export function resolveWithCapability(
    capability: FieldCapability,
    ctx: ConnectionContext
): any {
    if (capability.resolveConnectedValue) {
        return capability.resolveConnectedValue(ctx);
    }
    return defaultResolveConnectedValue(ctx);
}
