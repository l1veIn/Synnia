/**
 * Handle Types and Semantics
 * 
 * Standardized handle definitions for Synnia nodes.
 * All nodes should use these standard handle IDs.
 */

// --- Semantic Categories ---
export enum HandleSemantic {
    DATA_IN = 'data-in',   // Input data port
    DATA_OUT = 'data-out', // Output data port
    ORIGIN = 'origin',     // Where this node was generated from
    PRODUCT = 'product',   // What this node produces
}

// --- Data Types ---
export enum HandleDataType {
    TEXT = 'text',
    IMAGE = 'image',
    JSON = 'json',
    ARRAY = 'array',
    ANY = 'any',
}

// --- Handle Definition ---
export interface HandleDefinition {
    id: string;
    semantic: HandleSemantic;
    dataType: HandleDataType;
    position: 'top' | 'bottom' | 'left' | 'right';
    direction: 'source' | 'target';
}

// --- Standard Handle ID Constants ---
// Use these constants in node components for consistency

export const HANDLE_IDS = {
    // Edge Nodes (Text, Image, JSON)
    TEXT_OUT: 'text-out',
    IMAGE_OUT: 'image-out',
    JSON_OUT: 'json-out',

    // Collection Nodes (Selector, Table, Gallery, Queue)
    SELECTED: 'selected',
    ROWS: 'rows',
    IMAGES: 'images',
    STARRED: 'starred',
    TASKS: 'tasks',
    RESULTS: 'results',

    // Recipe Nodes
    PRODUCT: 'product',  // Recipe's output port (source), connects to product node's INPUT

    // Generic Input - also used as product target for Output Edge
    INPUT: 'input',
} as const;

// --- Standard Handle Definitions ---
export const HANDLES: Record<string, HandleDefinition> = {
    // Text Node
    [HANDLE_IDS.TEXT_OUT]: {
        id: HANDLE_IDS.TEXT_OUT,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.TEXT,
        position: 'bottom',
        direction: 'source',
    },

    // Image Node
    [HANDLE_IDS.IMAGE_OUT]: {
        id: HANDLE_IDS.IMAGE_OUT,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.IMAGE,
        position: 'bottom',
        direction: 'source',
    },

    // JSON Node
    [HANDLE_IDS.JSON_OUT]: {
        id: HANDLE_IDS.JSON_OUT,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.JSON,
        position: 'bottom',
        direction: 'source',
    },

    // Selector Node
    [HANDLE_IDS.SELECTED]: {
        id: HANDLE_IDS.SELECTED,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.ARRAY,
        position: 'bottom',
        direction: 'source',
    },

    // Gallery Node
    [HANDLE_IDS.IMAGES]: {
        id: HANDLE_IDS.IMAGES,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.ARRAY,
        position: 'bottom',
        direction: 'source',
    },
    [HANDLE_IDS.STARRED]: {
        id: HANDLE_IDS.STARRED,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.ARRAY,
        position: 'bottom',
        direction: 'source',
    },

    // Table Node
    [HANDLE_IDS.ROWS]: {
        id: HANDLE_IDS.ROWS,
        semantic: HandleSemantic.DATA_OUT,
        dataType: HandleDataType.ARRAY,
        position: 'bottom',
        direction: 'source',
    },

    // Recipe Node
    [HANDLE_IDS.PRODUCT]: {
        id: HANDLE_IDS.PRODUCT,
        semantic: HandleSemantic.PRODUCT,
        dataType: HandleDataType.ANY,
        position: 'bottom',
        direction: 'source',
    },
};
