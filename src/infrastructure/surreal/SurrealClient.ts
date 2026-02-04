export type SurrealConfig = {
    url: string;
    namespace: string;
    database: string;
    username?: string;
    password?: string;
    token?: string;
};

type SurrealResponse<T> = Array<{
    status: 'OK' | 'ERR';
    time?: string;
    result?: T;
    detail?: string;
}>;

export class SurrealClient {
    private readonly config: SurrealConfig;

    constructor(config: SurrealConfig) {
        this.config = config;
    }

    async query<T>(sql: string): Promise<T> {
        const res = await fetch(`${this.config.url}/sql`, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: sql,
        });

        const payload = (await res.json()) as SurrealResponse<T>;
        if (!res.ok) {
            throw new Error(`SurrealDB HTTP ${res.status}: ${JSON.stringify(payload)}`);
        }

        const first = payload[0];
        if (!first) {
            throw new Error('SurrealDB response missing payload');
        }
        if (first.status !== 'OK') {
            throw new Error(first.detail || 'SurrealDB query failed');
        }

        return first.result as T;
    }

    async queryMany<T>(sql: string): Promise<T[]> {
        const result = await this.query<T[] | T>(sql);
        return Array.isArray(result) ? result : [result];
    }

    private buildHeaders(): HeadersInit {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
            NS: this.config.namespace,
            DB: this.config.database,
        };

        if (this.config.token) {
            headers.Authorization = `Bearer ${this.config.token}`;
        } else if (this.config.username && this.config.password) {
            const encoded = btoa(`${this.config.username}:${this.config.password}`);
            headers.Authorization = `Basic ${encoded}`;
        }

        return headers;
    }
}
