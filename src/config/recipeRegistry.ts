import {
    Wand2,
    Image as ImageIcon,
    FileText,
    Scissors,
    Languages,
    Info, // For debug icon
    LucideIcon
} from 'lucide-react';

export interface RecipeInput {
    label: string;
    accepts: string[]; // Asset Types (e.g. ['image_asset', 'text_asset'])
    validate?: (node: any) => string | null; // Return error message if failed, null if success
}

export interface RecipeDefinition {
    id: string;
    label: string;
    description?: string;
    icon: LucideIcon;
    agentId: string; // Maps to backend Agent ID
    
    // Input Constraints (Multi-input support)
    inputs: RecipeInput[];

    // Parameters Schema (JSON Schema style)
    paramsSchema?: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'select';
        label: string;
        default?: any;
        options?: string[]; // For select
        min?: number;
        max?: number;
    }>;

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
        agentId: 'system_echo',
        inputs: [{
            label: 'Source',
            accepts: ['*']
        }],
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Node ID Info' }
        }
    },
    {
        id: 'debug_echo_hash',
        label: 'Debug: Echo Hash',
        description: 'Output the Hash of the source node',
        icon: Info,
        agentId: 'system_echo_hash',
        inputs: [{
            label: 'Source',
            accepts: ['*']
        }],
        output: {
            assetType: 'text_asset',
            initialProperties: { name: 'Hash Info' }
        }
    },
    {
        id: 'debug_reverse_text',
        label: 'Debug: Reverse Text',
        description: 'Reverses the content string',
        icon: Info,
        agentId: 'system_reverse',
        inputs: [{
            label: 'Text Source',
            accepts: ['text_asset', 'text'],
            validate: (node) => {
                // Example validation: Content length must be > 5
                const content = node.properties?.content || "";
                return content.length > 5 ? null : "Content length must be > 5";
            }
        }],
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
        agentId: 'sd_agent',
        inputs: [{
            label: 'Prompt',
            accepts: ['text_asset', 'prompt_asset']
        }],
        paramsSchema: {
            style: {
                type: 'select',
                label: 'Style',
                default: 'realistic',
                options: ['realistic', 'anime', 'sketch', 'oil painting']
            },
            steps: {
                type: 'number',
                label: 'Steps',
                default: 20,
                min: 10,
                max: 50
            }
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
        inputs: [{
            label: 'Document',
            accepts: ['text_asset', 'document_asset']
        }],
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
        inputs: [{
            label: 'Text',
            accepts: ['text_asset']
        }],
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
        inputs: [{
            label: 'Image',
            accepts: ['image_asset']
        }],
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
        inputs: [{
            label: 'Image',
            accepts: ['image_asset']
        }],
        output: {
            assetType: 'image_asset',
            initialProperties: { name: 'Variation' }
        }
    }
];

export const getRecipesForAsset = (assetType: string): RecipeDefinition[] => {
    return RECIPES.filter(r => 
        // Check the first input slot for compatibility context menu
        r.inputs.length > 0 && (
            r.inputs[0].accepts.includes('*') || 
            r.inputs[0].accepts.includes(assetType)
        )
    );
};