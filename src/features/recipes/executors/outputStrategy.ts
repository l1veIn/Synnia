// Output Strategy Utilities
// Handles record vs array output strategies with schema matching

import { FieldDefinition } from '@/types/assets';
import { OutputValueType } from '@/types/recipe';
import { nodeRegistry } from '@core/registry/NodeRegistry';

// ============================================================================
// Value Type Inference
// ============================================================================

/**
 * Infer valueType from node type if not explicitly specified.
 * Collection nodes (gallery, table, selector) → 'array'
 * All others (form, text) → 'record'
 */
export function inferValueType(nodeType: string, explicit?: OutputValueType): OutputValueType {
    if (explicit) return explicit;

    // Use nodeRegistry's isCollection if available
    if (nodeRegistry.isCollection(nodeType)) {
        return 'array';
    }

    // Fallback: known collection types
    const collectionTypes = ['gallery', 'table', 'selector'];
    return collectionTypes.includes(nodeType) ? 'array' : 'record';
}

// ============================================================================
// Schema Matching (Loose)
// ============================================================================

/**
 * Check if new data is compatible with existing schema (loose matching).
 * Compatible if all keys in new data exist in existing schema.
 * 
 * @param existingSchema - Schema of the existing asset
 * @param newData - New data to merge
 * @returns true if compatible
 */
export function isSchemaCompatible(
    existingSchema: FieldDefinition[] | undefined,
    newData: any
): boolean {
    if (!existingSchema || existingSchema.length === 0) {
        // No schema = accept anything
        return true;
    }

    if (!newData || typeof newData !== 'object') {
        return false;
    }

    // Get sample item if array
    const sample = Array.isArray(newData) ? newData[0] : newData;
    if (!sample || typeof sample !== 'object') {
        return true; // Empty or primitive = accept
    }

    // Loose match: all keys in sample should exist in schema
    const schemaKeys = new Set(existingSchema.map(f => f.key));
    const sampleKeys = Object.keys(sample);

    // At least 50% of new data keys should match schema (loose)
    const matchingKeys = sampleKeys.filter(k => schemaKeys.has(k));
    return matchingKeys.length >= Math.ceil(sampleKeys.length * 0.5);
}

// ============================================================================
// Output Strategy Types
// ============================================================================

export type OutputAction =
    | { type: 'update'; assetId: string }
    | { type: 'merge'; assetId: string }
    | { type: 'create' };

/**
 * Determine the output action based on valueType, existing product, and schema compatibility.
 */
export function determineOutputAction(
    valueType: OutputValueType,
    existingAsset: { id: string; config?: { schema?: FieldDefinition[] } } | null,
    newData: any
): OutputAction {
    if (!existingAsset) {
        return { type: 'create' };
    }

    if (valueType === 'record') {
        // Record: always update existing
        return { type: 'update', assetId: existingAsset.id };
    }

    // Array: check schema compatibility
    const schema = existingAsset.config?.schema;
    if (isSchemaCompatible(schema, newData)) {
        return { type: 'merge', assetId: existingAsset.id };
    }

    // Schema incompatible: create new
    return { type: 'create' };
}
