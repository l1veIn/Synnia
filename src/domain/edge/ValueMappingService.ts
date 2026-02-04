/**
 * ValueMappingService - Domain Service for Value Edge Resolution
 *
 * TEP Crystallized Principle: "能提取 = 能连接"
 *
 * This domain service provides unified logic for:
 * 1. Connection validation (canConnect)
 * 2. Runtime data extraction (getMergedInputValues)
 *
 * DOMAIN CONSTRAINTS:
 * - NO React dependencies
 * - NO Store dependencies
 * - NO Tauri dependencies
 */

import type { FieldDefinition } from '@/types/assets';

// ============================================================================
// Required Field Validation
// ============================================================================

/**
 * Check if a value satisfies the required condition for a field.
 * Recursively validates nested object schemas.
 */
export function isRequiredSatisfied(value: unknown, field: FieldDefinition): boolean {
    // Non-required fields always pass
    if (!field.required) {
        return true;
    }

    // Null/undefined always fails for required fields
    if (value === undefined || value === null) {
        return false;
    }

    switch (field.type) {
        case 'string':
            return typeof value === 'string' && value.trim() !== '';

        case 'number':
            return typeof value === 'number' && !isNaN(value);

        case 'boolean':
            return typeof value === 'boolean';

        case 'array':
            return Array.isArray(value) && value.length > 0;

        case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) {
                return false;
            }
            // Recursively check required sub-fields
            if (field.schema) {
                for (const subField of field.schema) {
                    if (subField.required) {
                        const subValue = (value as Record<string, unknown>)[subField.key];
                        if (!isRequiredSatisfied(subValue, subField)) {
                            return false;
                        }
                    }
                }
            }
            return true;

        default:
            // Unknown type, just check existence
            return true;
    }
}

/**
 * Check if a value matches the expected type.
 */
export function isTypeMatch(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number';
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        default:
            return true;
    }
}

// ============================================================================
// Smart Resolve
// ============================================================================

export interface SmartResolveResult {
    success: boolean;
    value: unknown;
    strategy: 'keyed' | 'structural' | 'none';
    error?: string;
}

/**
 * Smart Resolve: Intelligently extract value from source for target field.
 *
 * Strategy Priority:
 * 1. Keyed Extraction: source[targetKey] if exists and valid
 * 2. Structural Match: source itself if valid (object type only)
 * 3. Reject: return null
 *
 * @param source - The source object (typically from upstream node's output)
 * @param targetField - The target field definition
 * @returns Resolved value or null if cannot resolve
 */
export function smartResolve(
    source: unknown,
    targetField: FieldDefinition
): SmartResolveResult {

    // ─────────────────────────────────────────────────────────────────
    // Handle Array Source (not an object for keyed extraction)
    // ─────────────────────────────────────────────────────────────────
    if (Array.isArray(source)) {
        // If target expects array, direct match
        if (targetField.type === 'array' && isRequiredSatisfied(source, targetField)) {
            return { success: true, value: source, strategy: 'structural' };
        }

        // Fallback: Array → Single via arr[0]
        // Try to extract from first element if it's an object
        if (source.length > 0) {
            const firstItem = source[0];

            // If first item is an object, recursively resolve from it
            if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
                const firstItemObj = firstItem as Record<string, unknown>;

                // Try keyed extraction from first item
                if (targetField.key in firstItemObj) {
                    const extracted = firstItemObj[targetField.key];
                    if (isTypeMatch(extracted, targetField.type) && isRequiredSatisfied(extracted, targetField)) {
                        return { success: true, value: extracted, strategy: 'keyed' };
                    }
                }

                // If target expects object, use first item directly
                if (targetField.type === 'object' && isRequiredSatisfied(firstItem, targetField)) {
                    return { success: true, value: firstItem, strategy: 'structural' };
                }
            }

            // If first item directly matches target type
            if (isTypeMatch(firstItem, targetField.type) && isRequiredSatisfied(firstItem, targetField)) {
                return { success: true, value: firstItem, strategy: 'keyed' };
            }
        }

        return {
            success: false,
            value: null,
            strategy: 'none',
            error: `Source is an array, cannot resolve for field '${targetField.key}' (expected ${targetField.type})`
        };
    }

    // Source must be an object for smart resolution
    if (typeof source !== 'object' || source === null) {
        // Direct value for non-object sources
        if (isTypeMatch(source, targetField.type) && isRequiredSatisfied(source, targetField)) {
            return { success: true, value: source, strategy: 'keyed' };
        }
        return {
            success: false,
            value: null,
            strategy: 'none',
            error: `Source is not an object, cannot resolve for field '${targetField.key}'`
        };
    }

    const sourceObj = source as Record<string, unknown>;

    // ─────────────────────────────────────────────────────────────────
    // Strategy 1: Keyed Extraction
    // If source has a property with the same key as target, try to use it
    // ─────────────────────────────────────────────────────────────────
    if (targetField.key in sourceObj) {
        const extracted = sourceObj[targetField.key];

        if (isTypeMatch(extracted, targetField.type) && isRequiredSatisfied(extracted, targetField)) {
            return { success: true, value: extracted, strategy: 'keyed' };
        }

        // ─── Keyed Fallback: Array → Single ───
        // If extracted is array but target expects non-array, try arr[0]
        if (Array.isArray(extracted) && targetField.type !== 'array' && extracted.length > 0) {
            const firstItem = extracted[0];
            if (isTypeMatch(firstItem, targetField.type) && isRequiredSatisfied(firstItem, targetField)) {
                return { success: true, value: firstItem, strategy: 'keyed' };
            }
        }

        // ─── Keyed Fallback: Single → Array ───
        // If extracted is object and target expects array, try [obj]
        if (!Array.isArray(extracted) && targetField.type === 'array' &&
            typeof extracted === 'object' && extracted !== null) {
            const wrapped = [extracted];
            if (isRequiredSatisfied(wrapped, targetField)) {
                return { success: true, value: wrapped, strategy: 'keyed' };
            }
        }

        // Key exists but doesn't match - continue to try structural match
    }

    // ─────────────────────────────────────────────────────────────────
    // Strategy 2: Structural Match (object type only)
    // Use the entire source object as the value
    // ─────────────────────────────────────────────────────────────────
    if (targetField.type === 'object') {
        if (isRequiredSatisfied(source, targetField)) {
            return { success: true, value: source, strategy: 'structural' };
        }

        // Build detailed error message
        const missingKeys: string[] = [];
        if (targetField.schema) {
            for (const subField of targetField.schema) {
                if (subField.required) {
                    const subValue = sourceObj[subField.key];
                    if (!isRequiredSatisfied(subValue, subField)) {
                        missingKeys.push(subField.label || subField.key);
                    }
                }
            }
        }

        return {
            success: false,
            value: null,
            strategy: 'none',
            error: missingKeys.length > 0
                ? `Missing required fields: ${missingKeys.join(', ')}`
                : `Source does not satisfy field '${targetField.key}' requirements`
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // Strategy 3: Reject
    // ─────────────────────────────────────────────────────────────────
    return {
        success: false,
        value: null,
        strategy: 'none',
        error: `Cannot resolve value for field '${targetField.key}' (expected ${targetField.type})`
    };
}

/**
 * Convenience function: returns resolved value or null.
 */
export function smartResolveValue(source: unknown, targetField: FieldDefinition): unknown | null {
    const result = smartResolve(source, targetField);
    return result.success ? result.value : null;
}

/**
 * Convenience function: returns error message or null if success.
 */
export function smartResolveError(source: unknown, targetField: FieldDefinition): string | null {
    const result = smartResolve(source, targetField);
    return result.success ? null : (result.error || 'Cannot resolve value');
}
