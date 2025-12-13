import { defineRecipe } from '@/types/recipe';
import { Calculator } from 'lucide-react';

/**
 * Division Calculator Recipe
 * Divides A by B (B != 0)
 */
export const definition = defineRecipe({
    id: 'math.divide',
    name: 'Division',
    description: 'Divides A by B (B ≠ 0)',
    icon: Calculator,
    category: 'Math',

    inputSchema: [
        {
            id: 'a',
            key: 'a',
            label: 'Dividend (A)',
            type: 'number',
            widget: 'number',
            rules: { required: true }
        },
        {
            id: 'b',
            key: 'b',
            label: 'Divisor (B)',
            type: 'number',
            widget: 'number',
            rules: { required: true }
        }
    ],

    outputSchema: {
        type: 'json',
        description: 'Result of A / B'
    },

    execute: async (ctx) => {
        const { inputs } = ctx;

        // Extract values (handle potential Asset objects from connections)
        const extractNumber = (v: any): number => {
            if (typeof v === 'object' && v !== null) {
                if (v.content !== undefined) return Number(v.content);
                if (v.value !== undefined) return Number(v.value);
            }
            return Number(v);
        };

        const a = extractNumber(inputs.a);
        const b = extractNumber(inputs.b);

        // Validation
        if (inputs.a === '' || inputs.a === undefined) {
            return { success: false, error: "Missing 'a'" };
        }
        if (inputs.b === '' || inputs.b === undefined) {
            return { success: false, error: "Missing 'b'" };
        }
        if (isNaN(a) || isNaN(b)) {
            return { success: false, error: "A and B must be valid numbers" };
        }
        if (b === 0) {
            return { success: false, error: "Division by zero is not allowed" };
        }

        // Simulate processing delay
        await new Promise(r => setTimeout(r, 500));

        const result = a / b;

        return {
            success: true,
            data: {
                expression: `${a} / ${b}`,
                result,
                formatted: `${a} ÷ ${b} = ${result}`
            }
        };
    }
});
