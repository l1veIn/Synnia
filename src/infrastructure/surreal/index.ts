import { SurrealClient, type SurrealConfig } from './SurrealClient';
import { SurrealNodeRepository } from './NodeRepository';
import { SurrealEdgeRepository } from './EdgeRepository';
import { SurrealFileRepository } from './FileRepository';
import { SurrealExecutionRepository } from './ExecutionRepository';

export type SurrealRepositories = {
    client: SurrealClient;
    nodeRepository: SurrealNodeRepository;
    edgeRepository: SurrealEdgeRepository;
    fileRepository: SurrealFileRepository;
    executionRepository: SurrealExecutionRepository;
};

let repositories: SurrealRepositories | null = null;

export function getSurrealConfig(): SurrealConfig | null {
    const url = import.meta.env.VITE_SURREAL_URL as string | undefined;
    const namespace = import.meta.env.VITE_SURREAL_NS as string | undefined;
    const database = import.meta.env.VITE_SURREAL_DB as string | undefined;
    if (!url || !namespace || !database) return null;

    return {
        url,
        namespace,
        database,
        username: import.meta.env.VITE_SURREAL_USER as string | undefined,
        password: import.meta.env.VITE_SURREAL_PASS as string | undefined,
        token: import.meta.env.VITE_SURREAL_TOKEN as string | undefined,
    };
}

export function getSurrealRepositories(): SurrealRepositories | null {
    // Production builds must not use the HTTP Surreal client.
    if (import.meta.env.PROD) return null;

    if (repositories) return repositories;

    const config = getSurrealConfig();
    if (!config) return null;

    const client = new SurrealClient(config);
    repositories = {
        client,
        nodeRepository: new SurrealNodeRepository(client),
        edgeRepository: new SurrealEdgeRepository(client),
        fileRepository: new SurrealFileRepository(client),
        executionRepository: new SurrealExecutionRepository(client),
    };

    return repositories;
}
