import type { EdgeRepository } from '@/application/ports';
import type { Edge } from '@/domain/edge/Edge';
import { SurrealClient } from './SurrealClient';
import { normalizeRecordId, sqlJson, stripProjectId, thing } from './surrealUtils';

const TABLE = 'edge';

type EdgeRecord = Edge & { projectId: string; id: unknown };

export class SurrealEdgeRepository implements EdgeRepository {
    constructor(private readonly client: SurrealClient) {}

    async create(edge: Edge, projectId: string): Promise<void> {
        const record = { ...edge, projectId };
        const sql = `UPSERT ${thing(TABLE, edge.id)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async delete(id: string, projectId: string): Promise<void> {
        const sql = `DELETE FROM ${TABLE} WHERE id = ${thing(TABLE, id)} AND projectId = ${sqlJson(projectId)};`;
        await this.client.query(sql);
    }

    async listByProject(projectId: string): Promise<Edge[]> {
        const sql = `SELECT * FROM ${TABLE} WHERE projectId = ${sqlJson(projectId)};`;
        const results = await this.client.queryMany<EdgeRecord>(sql);
        return results.map(record => this.mapRecord(record));
    }

    private mapRecord(record: EdgeRecord): Edge {
        const recordId = normalizeRecordId(record.id, TABLE) ?? record.id;
        return {
            ...stripProjectId(record),
            id: String(recordId),
        } as Edge;
    }
}
