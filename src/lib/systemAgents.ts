export interface SystemAgent {
    id: string;
    name: string;
    description: string;
    requiredFields: string[]; // Simple validation check
    // In a real app, this would verify types too
    execute: (values: Record<string, any>) => Promise<{ type: 'text' | 'image' | 'json', content: any }>;
}

export const SYSTEM_AGENTS: SystemAgent[] = [
    {
        id: 'agent-division',
        name: 'Division Calculator',
        description: 'Divides A by B (B != 0)',
        requiredFields: ['a', 'b'],
        execute: async (values) => {
            const a = Number(values.a);
            const b = Number(values.b);
            
            // Loose validation for strings that look like numbers
            if (values.a === '' || values.a === undefined) throw new Error("Missing 'a'");
            if (values.b === '' || values.b === undefined) throw new Error("Missing 'b'");
            
            if (isNaN(a) || isNaN(b)) throw new Error("A and B must be valid numbers");
            if (b === 0) throw new Error("Division by zero is not allowed");
            
            // Mock Delay to feel like "Processing"
            await new Promise(r => setTimeout(r, 800));
            
            return {
                type: 'text',
                content: `Calculation Result:\n${a} / ${b} = ${a / b}`
            };
        }
    }
];

export const getSystemAgent = (id: string) => SYSTEM_AGENTS.find(a => a.id === id);