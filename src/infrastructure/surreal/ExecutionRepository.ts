import type { ExecutionRepository } from '@/application/ports';
import type { ExecutionRun } from '@/domain/recipe/ExecutionRun';
import { SurrealClient } from './SurrealClient';
import { normalizeRecordId, sqlJson, stripProjectId, thing } from './surrealUtils';

const TABLE = 'execution_run';

type ExecutionRecord = ExecutionRun & { projectId: string; id: unknown };

export class SurrealExecutionRepository implements ExecutionRepository {
    constructor(private readonly client: SurrealClient) {}

    async create(run: ExecutionRun, projectId: string): Promise<void> {
        const record = { ...run, projectId };
        const sql = `CREATE ${thing(TABLE, run.runId)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async update(run: ExecutionRun, projectId: string): Promise<void> {
        const record = { ...run, projectId };
        const sql = `UPDATE ${thing(TABLE, run.runId)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async listByNode(nodeId: string, projectId: string): Promise<ExecutionRun[]> {
        const sql = `SELECT * FROM ${TABLE} WHERE projectId = ${sqlJson(projectId)} AND (inputNodeId = ${sqlJson(nodeId)} OR outputNodeId = ${sqlJson(nodeId)}) ORDER BY startedAt DESC;`;
        const results = await this.client.queryMany<ExecutionRecord>(sql);
        return results.map(record => this.mapRecord(record));
    }

    private mapRecord(record: ExecutionRecord): ExecutionRun {
        const recordId = normalizeRecordId(record.id, TABLE);
        const base = stripProjectId(record) as ExecutionRun;
        if (!base.runId && recordId) {
            return { ...base, runId: recordId };
        }
        return base;
    }
}
