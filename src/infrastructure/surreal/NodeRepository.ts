import type { NodeRepository } from '@/application/ports';
import type { Node } from '@/domain/node/Node';
import { SurrealClient } from './SurrealClient';
import { normalizeRecordId, sqlJson, stripProjectId, thing } from './surrealUtils';

const TABLE = 'node';

type NodeRecord = Node & { projectId: string; id: unknown };

export class SurrealNodeRepository implements NodeRepository {
    constructor(private readonly client: SurrealClient) {}

    async create(node: Node, projectId: string): Promise<void> {
        const record = { ...node, projectId };
        const sql = `CREATE ${thing(TABLE, node.id)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async update(node: Node, projectId: string): Promise<void> {
        const record = { ...node, projectId };
        const sql = `UPDATE ${thing(TABLE, node.id)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async get(id: string, projectId: string): Promise<Node | null> {
        const sql = `SELECT * FROM ${TABLE} WHERE id = ${thing(TABLE, id)} AND projectId = ${sqlJson(projectId)};`;
        const results = await this.client.queryMany<NodeRecord>(sql);
        if (results.length === 0) return null;
        return this.mapRecord(results[0]);
    }

    async listByProject(projectId: string): Promise<Node[]> {
        const sql = `SELECT * FROM ${TABLE} WHERE projectId = ${sqlJson(projectId)};`;
        const results = await this.client.queryMany<NodeRecord>(sql);
        return results.map(record => this.mapRecord(record));
    }

    async delete(id: string, projectId: string): Promise<void> {
        const sql = `DELETE FROM ${TABLE} WHERE id = ${thing(TABLE, id)} AND projectId = ${sqlJson(projectId)};`;
        await this.client.query(sql);
    }

    private mapRecord(record: NodeRecord): Node {
        const recordId = normalizeRecordId(record.id, TABLE) ?? record.id;
        return {
            ...stripProjectId(record),
            id: String(recordId),
        } as Node;
    }
}
