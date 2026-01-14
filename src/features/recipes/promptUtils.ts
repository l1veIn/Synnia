// ============================================================================
// Executor Utility Functions
// Shared helpers for all executors
// ============================================================================

/**
 * Extract value from potentially wrapped input
 */
export const extractValue = (v: any): any => {
    if (typeof v === 'object' && v !== null) {
        if (v.content !== undefined) return v.content;
        if (v.value !== undefined) return v.value;
    }
    return v;
};

/**
 * Extract text specifically
 */
export const extractText = (v: any): string => String(extractValue(v) ?? '');

/**
 * Extract number specifically
 */
export const extractNumber = (v: any): number => Number(extractValue(v) ?? 0);

/**
 * Simple template interpolation: {{key}} -> value
 */
export const interpolate = (template: string, values: Record<string, any>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = values[key];
        return val !== undefined ? extractText(val) : '';
    });
};

/**
 * Attempt to repair a truncated JSON array
 * Tries to close open objects and arrays to salvage partial data
 */
export const repairTruncatedJsonArray = (jsonText: string): string | null => {
    let text = jsonText.trim();

    // Must start with [
    if (!text.startsWith('[')) return null;

    // If already valid, return as-is
    try {
        JSON.parse(text);
        return text;
    } catch { }

    // Try to find the last complete object
    const lastCompleteObject = text.lastIndexOf('}');
    if (lastCompleteObject === -1) return null;

    // Truncate after the last complete object and close the array
    text = text.substring(0, lastCompleteObject + 1);

    // Remove trailing comma if present
    text = text.replace(/,\s*$/, '');

    // Close the array
    text = text + ']';

    // Validate the repaired JSON
    try {
        JSON.parse(text);
        return text;
    } catch {
        return null;
    }
};
