import { 
    Wand2, 
    Image as ImageIcon, 
    FileText, 
    Scissors, 
    Languages,
    Info, // For debug icon
    LucideIcon
} from 'lucide-react';

export interface RecipeDefinition {
    id: string;
    label: string;
    description?: string;
    icon: LucideIcon;
    agentId: string; // Maps to backend Agent ID
    
    // Input Constraints
    input: {
        requiredTags?: string[];
        accepts: string[]; // Asset Types (e.g. ['image_asset', 'text_asset'])
        // '*' means accepts anything
    };

    // Output Definition
    output: {
        assetType: string; // result node type
        initialProperties?: Record<string, any>;
    };
}

export const RECIPES: RecipeDefinition[] = [
    {
        id: 'debug_echo_id',
        label: 'Debug: Echo ID',
        description: 'Output the ID of the source node',
        icon: Info,
        agentId: 'system_echo', // Special system agent
        input: {
            accepts: ['*'] // Wildcard
        },
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Node ID Info' }
        }
    },
    {
        id: 'debug_echo_hash',
        label: 'Debug: Echo Hash',
        description: 'Output the Hash of the source node (for testing consistency)',
        icon: Info,
        agentId: 'system_echo_hash',
        input: {
            accepts: ['*']
        },
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Hash Info' }
        }
    },
    {
        id: 'debug_reverse_text',
        label: 'Debug: Reverse Text',
        description: 'Reverses the content string (deterministic transformation)',
        icon: Info,
        agentId: 'system_reverse',
        input: {
            accepts: ['text_asset', 'text']
        },
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Reversed Text' }
        }
    },
    {
        id: 'text_to_image',
        label: 'Text to Image',
        description: 'Generate an image from this text/prompt',
        icon: ImageIcon,
        agentId: 'sd_agent', // Mock ID
        input: {
            accepts: ['text_asset', 'prompt_asset']
        },
        output: {
            assetType: 'image_asset',
            initialProperties: { name: 'Generated Image', status: 'processing' }
        }
    },
    {
        id: 'summarize_text',
        label: 'Summarize',
        description: 'Create a summary of this note',
        icon: FileText,
        agentId: 'llm_agent',
        input: {
            accepts: ['text_asset', 'document_asset']
        },
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Summary', content: 'Generating summary...' }
        }
    },
    {
        id: 'translate_text',
        label: 'Translate to English',
        description: 'Translate content',
        icon: Languages,
        agentId: 'llm_translator',
        input: {
            accepts: ['text_asset']
        },
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Translation', content: 'Translating...' }
        }
    },
    {
        id: 'remove_bg',
        label: 'Remove Background',
        description: 'Remove background from image',
        icon: Scissors,
        agentId: 'rembg_agent',
        input: {
            accepts: ['image_asset']
        },
        output: {
            assetType: 'image_asset',
            initialProperties: { name: 'No-BG Image' }
        }
    },
    {
        id: 'image_variation',
        label: 'Image Variation',
        description: 'Generate variations of this image',
        icon: Wand2,
        agentId: 'sd_img2img',
        input: {
            accepts: ['image_asset']
        },
        output: {
            assetType: 'image_asset',
            initialProperties: { name: 'Variation' }
        }
    }
];

export const getRecipesForAsset = (assetType: string): RecipeDefinition[] => {
    return RECIPES.filter(r => 
        r.input.accepts.includes('*') || r.input.accepts.includes(assetType)
    );
};