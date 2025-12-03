import { SynniaProject, SynniaNode, SynniaEdge } from '../types/project';

// --- Initial Mock Data ---

const MOCK_NODES: SynniaNode[] = [
    {
        id: 'node-1',
        type: 'Asset',
        position: { x: 100, y: 100 },
        data: {
            assetType: 'image_asset',
            status: 'success',
            properties: { name: 'Source Image', src: 'https://picsum.photos/200/300' }
        }
    },
    {
        id: 'node-2',
        type: 'Asset',
        position: { x: 400, y: 100 },
        data: {
            assetType: 'image_asset',
            status: 'processing',
            properties: { name: 'Processed Result' }
        }
    },
    // --- The Collection Node ---
    {
        id: 'collection-1',
        type: 'Asset',
        position: { x: 100, y: 400 },
        width: 400,
        height: 300,
        data: {
            assetType: 'collection_asset',
            status: 'idle',
            properties: { name: 'My Workspace' }
        }
    },
    // --- Child Node inside Collection ---
    {
        id: 'node-child-1',
        type: 'Asset',
        parentId: 'collection-1', // Key: This makes it a child
        extent: 'parent',         // Key: Constrains movement
        position: { x: 50, y: 50 }, // Relative to collection-1
        data: {
            assetType: 'text_asset',
            status: 'idle',
            properties: { name: 'Notes', content: 'Inside the box!' }
        }
    }
];

const MOCK_EDGES: SynniaEdge[] = [
    { id: 'e1-2', source: 'node-1', target: 'node-2' }
];

const MOCK_PROJECT: SynniaProject = {
    version: '3.2.0-mock',
    meta: {
        id: 'mock-project-001',
        name: 'Frontend Dev Sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'Dev'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    graph: {
        nodes: MOCK_NODES,
        edges: MOCK_EDGES
    },
    settings: {}
};

// --- API Client ---

export const apiClient = {
    // Simulate loading a project
    loadProject: async (id: string): Promise<SynniaProject> => {
        console.log(`[MockAPI] Loading project ${id}...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Fake latency
        return MOCK_PROJECT;
    },

    // Simulate creating a project
    createProject: async (name: string): Promise<string> => {
        console.log(`[MockAPI] Creating project ${name}...`);
        return 'mock-project-new';
    },
    
    // Add other stubs as needed
    saveGraph: async () => console.log('[MockAPI] Graph saved (noop)'),
    invoke: async (cmd: string, args: any) => {
        console.log(`[MockAPI] Invoke: ${cmd}`, args);
        // Return sensible defaults based on command if needed
        if (cmd === 'get_system_agents') return [];
        return null;
    }
};
