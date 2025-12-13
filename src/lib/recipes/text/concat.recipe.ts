import { defineRecipe } from '@/types/recipe';
import { TextCursor } from 'lucide-react';

/**
 * Text Concatenator Recipe
 * Joins two text inputs
 */
export const definition = defineRecipe({
    id: 'text.concat',
    name: 'Concatenate',
    description: 'Joins two text inputs together',
    icon: TextCursor,
    category: 'Text',

    inputSchema: [
        {
            id: 'text1',
            key: 'text1',
            label: 'Text 1',
            type: 'string',
            widget: 'textarea',
            rules: { required: true },
            connection: { input: true }  // Input handle on left
        },
        {
            id: 'text2',
            key: 'text2',
            label: 'Text 2',
            type: 'string',
            widget: 'textarea',
            rules: { required: true },
            connection: { input: true }  // Input handle on left
        },
        {
            id: 'separator',
            key: 'separator',
            label: 'Separator',
            type: 'string',
            widget: 'text',
            defaultValue: '\n\n',
            rules: { placeholder: 'Default: newline' }
        },
        {
            id: 'result',
            key: 'result',
            label: 'Result',
            type: 'string',
            widget: 'none',  // Not editable in form
            disabled: true,   // Read-only
            connection: { output: true }  // Output handle on right
        }
    ],

    outputSchema: {
        type: 'text',
        description: 'Concatenated text result'
    },

    execute: async (ctx) => {
        const { inputs } = ctx;

        // Extract text values
        const extractText = (v: any): string => {
            if (typeof v === 'object' && v !== null) {
                if (v.content !== undefined) return String(v.content);
                if (v.value !== undefined) return String(v.value);
            }
            return String(v || '');
        };

        const text1 = extractText(inputs.text1);
        const text2 = extractText(inputs.text2);
        const separator = inputs.separator !== undefined ? String(inputs.separator) : '\n\n';

        // Simulate processing
        await new Promise(r => setTimeout(r, 300));

        const merged = `${text1}${separator}${text2}`;

        return {
            success: true,
            data: {
                result: merged,
                length: merged.length
            }
        };
    }
});
