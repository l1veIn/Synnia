// LLM Utility Functions

/**
 * Attempt to repair a truncated JSON array
 */
export function repairTruncatedJsonArray(jsonText: string): string | null {
    let text = jsonText.trim();
    if (!text.startsWith('[')) return null;

    try {
        JSON.parse(text);
        return text;
    } catch (_) { /* parse failed, continue */ }

    const lastCompleteObject = text.lastIndexOf('}');
    if (lastCompleteObject === -1) return null;

    text = text.substring(0, lastCompleteObject + 1);
    text = text.replace(/,\s*$/, '');
    text = text + ']';

    try {
        JSON.parse(text);
        return text;
    } catch {
        return null;
    }
}

/**
 * Extract JSON from LLM response text
 */
export function extractJson(text: string): { data: any; success: boolean } {
    // Try to extract JSON from markdown code blocks
    let jsonText = text;
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1];
    } else {
        // Try to find JSON array pattern
        const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) jsonText = arrayMatch[0];
    }

    try {
        return { data: JSON.parse(jsonText), success: true };
    } catch (_) {
        // Try to repair truncated JSON
        const repaired = repairTruncatedJsonArray(jsonText);
        if (repaired) {
            return { data: JSON.parse(repaired), success: true };
        }
        return { data: null, success: false };
    }
}
