import { SynniaProject, SynniaNode, SynniaEdge } from '@/bindings/synnia';
import { Asset } from '@/types/assets';
import { invoke } from '@tauri-apps/api/core';

// --- Initial Mock Data (V2 Architecture) ---

const now = Date.now();

const MOCK_ASSETS: Record<string, Asset> = {
    'asset-img-1': {
        id: 'asset-img-1',
        type: 'image',
        content: 'https://picsum.photos/200/300',
        metadata: { 
            name: 'Source Image', 
            createdAt: now, 
            updatedAt: now, 
            source: 'user', 
            extra: {} 
        }
    },
    'asset-txt-1': {
        id: 'asset-txt-1',
        type: 'text',
        content: 'Processed Result Text',
        metadata: { 
            name: 'Result', 
            createdAt: now, 
            updatedAt: now, 
            source: 'user', 
            extra: {} 
        }
    }
};

const MOCK_NODES: SynniaNode[] = [
    {
        id: 'node-1',
        type: 'asset-node',
        position: { x: 100, y: 100 },
        width: null, height: null, parentId: null, extent: null, style: {},
        data: {
            title: 'Source Image',
            assetId: 'asset-img-1',
            isReference: false,
            collapsed: false,
            layoutMode: 'free',
            dockedTo: null,
            state: 'idle',
            other: {}
        }
    },
    {
        id: 'node-2',
        type: 'asset-node',
        position: { x: 400, y: 100 },
        width: null, height: null, parentId: null, extent: null, style: {},
        data: {
            title: 'Processed Result',
            assetId: 'asset-txt-1',
            isReference: false,
            collapsed: false,
            layoutMode: 'free',
            dockedTo: null,
            state: 'processing',
            other: {}
        }
    },
    {
        id: 'group-1',
        type: 'group-node',
        position: { x: 100, y: 400 },
        width: 400,
        height: 300,
        parentId: null, extent: null, style: {},
        data: {
            title: 'My Workspace',
            assetId: null,
            isReference: false,
            collapsed: false,
            layoutMode: 'free',
            dockedTo: null,
            state: 'idle',
            other: {}
        }
    }
];

const MOCK_EDGES: SynniaEdge[] = [
    { id: 'e1-2', source: 'node-1', target: 'node-2', sourceHandle: null, targetHandle: null, type: null, label: null, animated: true }
];

const MOCK_PROJECT: SynniaProject = {
    version: '2.0.0-mock',
    meta: {
        id: 'mock-project-001',
        name: 'Frontend Dev Sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnail: null,
        description: null,
        author: 'Dev'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    graph: {
        nodes: MOCK_NODES,
        edges: MOCK_EDGES
    },
    assets: MOCK_ASSETS,
    settings: {}
};

// Mock Recent Projects for Dashboard
const MOCK_RECENTS = [
    { name: 'Demo Project', path: '/local/demo', last_opened: new Date().toISOString() },
    { name: 'Test Sandbox', path: '/local/test', last_opened: new Date(Date.now() - 86400000).toISOString() }
];

// Check Tauri environment (Robust check)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// --- API Client ---

export const apiClient = {
    
    // Universal Invoke Wrapper
    invoke: async <T>(cmd: string, args?: any): Promise<T> => {
        if (isTauri) {
            try {
                return await invoke<T>(cmd, args);
            } catch (e) {
                console.error(`[Tauri] Command '${cmd}' failed:`, e);
                throw e;
            }
        }

        // --- Mock Implementation (Browser Mode) ---
        console.groupCollapsed(`[MockAPI] Invoke: ${cmd}`);
        console.log("Args:", args);
        console.groupEnd();
        
        // Simulate Network Latency
        await new Promise(resolve => setTimeout(resolve, 300));

        switch (cmd) {
            case 'get_system_agents': return [] as T;
            
            case 'get_recent_projects': 
                // Return empty list or mocks depending on dev needs. 
                // Defaulting to mocks to show UI.
                return MOCK_RECENTS as T;
                
            case 'init_project': 
                return { message: "Project Initialized (Mock)" } as T;
                
            case 'load_project':
                return MOCK_PROJECT as T;

            case 'create_project':
                return "mock-project-path" as T;

            case 'delete_project':
                return null as T; 
            
            case 'rename_project':
                return "new-mock-path" as T;
            
            case 'get_default_projects_path':
                return "/Mock/Documents/SynniaProjects" as T;

            case 'open_in_browser':
                console.log('Open Browser:', args.url);
                return null as T;
                
            case 'save_project':
                console.log("Project Saved (Mock)");
                return null as T;

            case 'save_project_autosave':
                return null as T;

            default:
                console.warn(`[MockAPI] Unknown command: ${cmd}`);
                return null as T;
        }
    },

    // Helpers
    loadProject: async (path: string): Promise<SynniaProject> => {
        return apiClient.invoke('load_project', { path });
    },

    saveGraph: async () => {
        // This needs the full project object. 
        // Usually the store calls save_project directly via invoke.
        console.log('[MockAPI] Use invoke("save_project") instead.');
    }
};
