/**
 * Schema Compatibility Checker
 * Compares a schema snapshot with the current recipe schema
 */

interface SchemaField {
    key: string;
    label?: string;
}

export interface SchemaCompatResult {
    compatible: boolean;
    warnings: string[];
    added: string[];    // Fields added in current schema
    removed: string[];  // Fields missing from current schema (were in snapshot)
}

/**
 * Check compatibility between a schema snapshot and the current schema
 */
export function checkSchemaCompatibility(
    snapshot: SchemaField[] | undefined,
    current: SchemaField[]
): SchemaCompatResult {
    // No snapshot means first run or legacy node - always compatible
    if (!snapshot || snapshot.length === 0) {
        return { compatible: true, warnings: [], added: [], removed: [] };
    }

    const snapshotKeys = new Set(snapshot.map(f => f.key));
    const currentKeys = new Set(current.map(f => f.key));

    const added: string[] = [];
    const removed: string[] = [];
    const warnings: string[] = [];

    // Find removed fields (in snapshot but not in current)
    for (const key of snapshotKeys) {
        if (!currentKeys.has(key)) {
            removed.push(key);
            const field = snapshot.find(f => f.key === key);
            warnings.push(`Field "${field?.label || key}" was removed from recipe`);
        }
    }

    // Find added fields (in current but not in snapshot)
    for (const key of currentKeys) {
        if (!snapshotKeys.has(key)) {
            added.push(key);
        }
    }

    // Removed fields make schema incompatible (data loss risk)
    const compatible = removed.length === 0;

    return { compatible, warnings, added, removed };
}
