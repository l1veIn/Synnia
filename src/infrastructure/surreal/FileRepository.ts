import type { FileRepository } from '@/application/ports';
import type { File } from '@/domain/file/File';
import { SurrealClient } from './SurrealClient';
import { normalizeRecordId, sqlJson, stripProjectId, thing } from './surrealUtils';

const TABLE = 'file';

type FileRecord = File & { projectId: string; id: unknown };

export class SurrealFileRepository implements FileRepository {
    constructor(private readonly client: SurrealClient) {}

    async create(file: File, projectId: string): Promise<void> {
        const record = { ...file, projectId };
        const sql = `UPSERT ${thing(TABLE, file.id)} CONTENT ${sqlJson(record)};`;
        await this.client.query(sql);
    }

    async get(id: string, projectId: string): Promise<File | null> {
        const sql = `SELECT * FROM ${TABLE} WHERE id = ${thing(TABLE, id)} AND projectId = ${sqlJson(projectId)};`;
        const results = await this.client.queryMany<FileRecord>(sql);
        if (results.length === 0) return null;
        return this.mapRecord(results[0]);
    }

    async listByProject(projectId: string): Promise<File[]> {
        const sql = `SELECT * FROM ${TABLE} WHERE projectId = ${sqlJson(projectId)};`;
        const results = await this.client.queryMany<FileRecord>(sql);
        return results.map(record => this.mapRecord(record));
    }

    async delete(id: string, projectId: string): Promise<void> {
        const sql = `DELETE FROM ${TABLE} WHERE id = ${thing(TABLE, id)} AND projectId = ${sqlJson(projectId)};`;
        await this.client.query(sql);
    }

    private mapRecord(record: FileRecord): File {
        const recordId = normalizeRecordId(record.id, TABLE) ?? record.id;
        return {
            ...stripProjectId(record),
            id: String(recordId),
        } as File;
    }
}
