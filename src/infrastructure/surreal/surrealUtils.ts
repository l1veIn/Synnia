export function sqlJson(value: unknown): string {
    return JSON.stringify(value);
}

export function thing(table: string, id: string): string {
    return `${table}:${JSON.stringify(id)}`;
}

export function normalizeRecordId(recordId: unknown, table: string): string | null {
    if (!recordId) return null;

    if (typeof recordId === 'string') {
        const prefix = `${table}:`;
        if (recordId.startsWith(prefix)) {
            return recordId.slice(prefix.length);
        }
        return recordId;
    }

    if (typeof recordId === 'object') {
        const maybe = recordId as { tb?: unknown; id?: unknown };
        if (maybe.tb === table && maybe.id !== undefined && maybe.id !== null) {
            return String(maybe.id);
        }
    }

    return null;
}

export function stripProjectId<T extends Record<string, unknown>>(record: T): Omit<T, 'projectId'> {
    const { projectId, ...rest } = record;
    return rest as Omit<T, 'projectId'>;
}
