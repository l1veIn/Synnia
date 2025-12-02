import { 
    FileText, 
    Terminal, 
    Image as ImageIcon, 
    Video, 
    File as FileIcon, 
    Box, 
    Folder, 
    LayoutTemplate,
    Type,
    Music,
    Database,
    Link, // Added Link icon
    LucideIcon
} from 'lucide-react';

export interface AssetTypeDefinition {
    id: string;
    label: string;
    icon: LucideIcon;
    description?: string;
    initialData?: {
        assetType: string;
        properties: Record<string, any>;
        tags?: string[];
    };
    dialogType?: 'none' | 'image_upload' | 'struct_builder' | 'collection_config'; 
}

export interface MenuItem {
    id: string;
    label: string;
    icon?: LucideIcon;
    type?: 'item' | 'separator' | 'group';
    action?: 'create' | 'import' | 'dialog';
    assetTypeId?: string; // Links to AssetTypeDefinition
    children?: MenuItem[];
    shortcut?: string;
}

// --- 1. Asset Definitions (The DNA) ---
export const ASSET_TYPES: Record<string, AssetTypeDefinition> = {
    'text_asset': {
        id: 'text_asset',
        label: 'Simple Text',
        icon: FileText,
        initialData: {
            assetType: 'text_asset',
            properties: { name: 'New Note', content: '' }
        }
    },
    'prompt_asset': {
        id: 'prompt_asset',
        label: 'Prompt',
        icon: Terminal,
        initialData: {
            assetType: 'prompt_asset',
            properties: { name: 'New Prompt', content: '', negative_prompt: '' }
        }
    },
    'image_asset': {
        id: 'image_asset',
        label: 'Image',
        icon: ImageIcon,
        dialogType: 'image_upload',
        initialData: {
            assetType: 'image_asset',
            properties: { name: 'New Image' }
        }
    },
    'video_asset': {
        id: 'video_asset',
        label: 'Video',
        icon: Video,
        dialogType: 'none', // Placeholder
        initialData: {
            assetType: 'video_asset',
            properties: { name: 'New Video' }
        }
    },
    'audio_asset': {
        id: 'audio_asset',
        label: 'Audio',
        icon: Music,
        dialogType: 'none',
        initialData: {
            assetType: 'audio_asset',
            properties: { name: 'New Audio' }
        }
    },
    'document_asset': {
        id: 'document_asset',
        label: 'Document',
        icon: FileIcon,
        dialogType: 'none',
        initialData: {
            assetType: 'document_asset',
            properties: { name: 'New Doc' }
        }
    },
    'struct_asset': {
        id: 'struct_asset',
        label: 'Custom Object',
        icon: Box,
        dialogType: 'struct_builder', // Future
        initialData: {
            assetType: 'struct_asset',
            properties: { name: 'New Object' }
        }
    },
    'collection_asset': {
        id: 'collection_asset',
        label: 'Empty Collection',
        icon: Folder,
        dialogType: 'collection_config', // Future
        initialData: {
            assetType: 'collection_asset',
            properties: { name: 'New Collection', members: [] }
        }
    },
    'reference_asset': {
        id: 'reference_asset',
        label: 'Shortcut',
        icon: Link,
        initialData: {
            assetType: 'reference_asset',
            properties: { targetId: '' } // Should be filled dynamically
        }
    },
    // Templates (Pre-configured Assets)
    'tpl_character': {
        id: 'tpl_character',
        label: 'Character Card',
        icon: Type,
        initialData: {
            assetType: 'struct_asset', // It's technically a struct
            tags: ['Role'],
            properties: { 
                name: 'New Character', 
                age: 20, 
                role: 'NPC',
                description: 'A stranger.' 
            }
        }
    }
};

// --- 2. Menu Structure (The View) ---
export const CONTEXT_MENU_STRUCTURE: MenuItem[] = [
    {
        id: 'create_text',
        label: 'Simple Text',
        type: 'item',
        action: 'create',
        assetTypeId: 'text_asset',
        icon: FileText,
        shortcut: 'T'
    },
    {
        id: 'create_prompt',
        label: 'Prompt',
        type: 'item',
        action: 'create',
        assetTypeId: 'prompt_asset',
        icon: Terminal,
        shortcut: 'P'
    },
    {
        id: 'group_media',
        label: 'Media / Docs',
        type: 'group',
        icon: Database, // Generic db/resource icon
        children: [
            { id: 'create_img', label: 'Image', type: 'item', action: 'dialog', assetTypeId: 'image_asset', icon: ImageIcon },
            { id: 'create_vid', label: 'Video', type: 'item', action: 'create', assetTypeId: 'video_asset', icon: Video }, // 'create' for placeholder
            { id: 'create_audio', label: 'Audio', type: 'item', action: 'create', assetTypeId: 'audio_asset', icon: Music },
            { id: 'create_doc', label: 'Document', type: 'item', action: 'create', assetTypeId: 'document_asset', icon: FileIcon },
        ]
    },
    {
        id: 'create_struct',
        label: 'Custom Object',
        type: 'item',
        action: 'dialog', // Will open Builder
        assetTypeId: 'struct_asset',
        icon: Box
    },
    {
        id: 'create_collection',
        label: 'Empty Collection',
        type: 'item',
        action: 'dialog', // Will open Config
        assetTypeId: 'collection_asset',
        icon: Folder
    },
    { id: 'sep1', label: '-', type: 'separator' },
    {
        id: 'group_templates',
        label: 'Templates',
        type: 'group',
        icon: LayoutTemplate,
        children: [
             { id: 'tpl_char', label: 'Character Card', type: 'item', action: 'create', assetTypeId: 'tpl_character', icon: Type },
             // Add more templates here
        ]
    }
];