import type { Node } from '@/domain/node/Node';
import type { Edge } from '@/domain/edge/Edge';
import type { File } from '@/domain/file/File';
import type { ExecutionRun } from '@/domain/recipe/ExecutionRun';

/**
 * Repository interfaces for persistence.
 * projectId is required to enforce per-project isolation.
 */
export interface NodeRepository {
    create(node: Node, projectId: string): Promise<void>;
    update(node: Node, projectId: string): Promise<void>;
    get(id: string, projectId: string): Promise<Node | null>;
    listByProject(projectId: string): Promise<Node[]>;
    delete(id: string, projectId: string): Promise<void>;
}

export interface EdgeRepository {
    create(edge: Edge, projectId: string): Promise<void>;
    delete(id: string, projectId: string): Promise<void>;
    listByProject(projectId: string): Promise<Edge[]>;
}

export interface FileRepository {
    create(file: File, projectId: string): Promise<void>;
    get(id: string, projectId: string): Promise<File | null>;
    listByProject(projectId: string): Promise<File[]>;
    delete(id: string, projectId: string): Promise<void>;
}

export interface ExecutionRepository {
    create(run: ExecutionRun, projectId: string): Promise<void>;
    update(run: ExecutionRun, projectId: string): Promise<void>;
    listByNode(nodeId: string, projectId: string): Promise<ExecutionRun[]>;
}
