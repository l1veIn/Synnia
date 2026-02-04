import type { NodeRepository, EdgeRepository, FileRepository } from '@/application/ports';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { File } from '@/domain/file/File';
import type { Node } from '@/domain/node/Node';
import type { Edge } from '@/domain/edge/Edge';
import { fromLegacy, toLegacyAsset, toLegacySynniaNode } from '@/application/adapters/nodeProjection';
import { fromLegacyEdge, toLegacyEdge } from '@/application/adapters/edgeProjection';

export type ProjectSnapshot = {
    nodes: SynniaNode[];
    edges: SynniaEdge[];
    assets: Record<string, Asset>;
    files: Record<string, File>;
};

export type LoadProjectSnapshotDeps = {
    projectId: string;
    nodeRepository: NodeRepository;
    edgeRepository: EdgeRepository;
    fileRepository: FileRepository;
};

export type SaveProjectSnapshotDeps = LoadProjectSnapshotDeps & {
    nodes: SynniaNode[];
    edges: SynniaEdge[];
    assets: Record<string, Asset>;
    files: Record<string, File>;
};

export async function loadProjectSnapshot(deps: LoadProjectSnapshotDeps): Promise<ProjectSnapshot> {
    const [nodes, edges, files] = await Promise.all([
        deps.nodeRepository.listByProject(deps.projectId),
        deps.edgeRepository.listByProject(deps.projectId),
        deps.fileRepository.listByProject(deps.projectId),
    ]);

    const legacyNodes = nodes.map(node => toLegacySynniaNode(node));
    const legacyEdges = edges.map(edge => toLegacyEdge(edge));
    const assets = buildAssets(nodes);
    const filesById = indexById(files);

    return {
        nodes: legacyNodes,
        edges: legacyEdges,
        assets,
        files: filesById,
    };
}

export async function saveProjectSnapshot(deps: SaveProjectSnapshotDeps): Promise<void> {
    const domainNodes = deps.nodes.map(node => fromLegacy(node, deps.assets));
    const domainEdges = deps.edges.map(edge => fromLegacyEdge(edge));

    await Promise.all([
        syncNodes(domainNodes, deps),
        syncEdges(domainEdges, deps),
        syncFiles(Object.values(deps.files), deps),
    ]);
}

function buildAssets(nodes: Node[]): Record<string, Asset> {
    return nodes.reduce<Record<string, Asset>>((acc, node) => {
        const asset = toLegacyAsset(node);
        acc[asset.id] = asset;
        return acc;
    }, {});
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
    return items.reduce<Record<string, T>>((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {});
}

async function syncNodes(nodes: Node[], deps: LoadProjectSnapshotDeps): Promise<void> {
    const existing = await deps.nodeRepository.listByProject(deps.projectId);
    const existingIds = new Set(existing.map(node => node.id));
    const nextIds = new Set(nodes.map(node => node.id));

    for (const node of nodes) {
        if (existingIds.has(node.id)) {
            await deps.nodeRepository.update(node, deps.projectId);
        } else {
            await deps.nodeRepository.create(node, deps.projectId);
        }
    }

    for (const node of existing) {
        if (!nextIds.has(node.id)) {
            await deps.nodeRepository.delete(node.id, deps.projectId);
        }
    }
}

async function syncEdges(edges: Edge[], deps: LoadProjectSnapshotDeps): Promise<void> {
    const existing = await deps.edgeRepository.listByProject(deps.projectId);
    const nextIds = new Set(edges.map(edge => edge.id));

    for (const edge of edges) {
        await deps.edgeRepository.create(edge, deps.projectId);
    }

    for (const edge of existing) {
        if (!nextIds.has(edge.id)) {
            await deps.edgeRepository.delete(edge.id, deps.projectId);
        }
    }
}

async function syncFiles(files: File[], deps: LoadProjectSnapshotDeps): Promise<void> {
    const existing = await deps.fileRepository.listByProject(deps.projectId);
    const existingIds = new Set(existing.map(file => file.id));
    const nextIds = new Set(files.map(file => file.id));

    for (const file of files) {
        await deps.fileRepository.create(file, deps.projectId);
    }

    for (const file of existing) {
        if (!nextIds.has(file.id)) {
            await deps.fileRepository.delete(file.id, deps.projectId);
        }
    }
}
