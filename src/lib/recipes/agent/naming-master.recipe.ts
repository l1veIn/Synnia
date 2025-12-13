import { defineRecipe, ExecutionResult } from '@/types/recipe';
import { Wand2 } from 'lucide-react';
import { getRecipe } from '../index';
import { NodeType } from '@/types/project';

/**
 * Naming Master Agent Recipe
 * Generates brand IP character names using the Relevance Spectrum strategy.
 * Mixins llm.call for LLM capabilities.
 */
export const definition = defineRecipe({
    id: 'agent.naming-master',
    name: 'Naming Master',
    description: 'Generate brand IP character names using spectrum strategy',
    icon: Wand2,
    category: 'Agent',

    // Inherit from llm.call
    mixin: ['llm.call'],

    inputSchema: [
        // New agent-specific fields
        {
            id: 'productType',
            key: 'productType',
            label: 'Product Type',
            type: 'string',
            widget: 'text',
            rules: { required: true, placeholder: 'e.g., Weather App, E-commerce Platform...' },
            connection: { input: true }
        },
        {
            id: 'targetAudience',
            key: 'targetAudience',
            label: 'Target Audience',
            type: 'string',
            widget: 'text',
            rules: { placeholder: 'e.g., Young professionals, Gen-Z gamers...' },
            connection: { input: true }
        },
        {
            id: 'brandTone',
            key: 'brandTone',
            label: 'Brand Tone',
            type: 'string',
            widget: 'text',
            rules: { placeholder: 'e.g., Playful, Professional, Techy...' },
            connection: { input: true }
        },
        {
            id: 'language',
            key: 'language',
            label: 'Language',
            type: 'select',
            widget: 'select',
            defaultValue: 'zh',
            rules: { options: ['zh', 'en'] }
        },
        // Override mixin fields
        {
            id: 'prompt',
            key: 'prompt',
            label: 'Prompt',
            type: 'string',
            hidden: true,  // Hide - we generate this internally
            defaultValue: ''
        },
        {
            id: 'systemPrompt',
            key: 'systemPrompt',
            label: 'System Prompt',
            type: 'string',
            hidden: true,  // Hide - we set this internally
            defaultValue: ''
        },
        {
            id: 'temperature',
            key: 'temperature',
            label: 'Creativity',
            type: 'number',
            widget: 'slider',
            defaultValue: 0.9,  // Higher for creative naming
            rules: { min: 0, max: 2, step: 0.1 }
        },
        {
            id: 'maxTokens',
            key: 'maxTokens',
            label: 'Max Tokens',
            type: 'number',
            hidden: true,  // Hide advanced settings
            defaultValue: 4096
        }
    ],

    outputSchema: {
        type: 'json',
        description: 'Array of naming options with rationale'
    },

    execute: async (ctx) => {
        const { inputs } = ctx;

        // Build the naming prompt
        const lang = inputs.language || 'zh';

        const systemInstruction = lang === 'zh'
            ? `你是一位虚拟IP角色命名专家。你的任务是给品牌虚拟IP角色起名。

【命名光谱策略】
生成 9 个名字：
1. [1-3号] 紧密相关：直观体现产品核心功能
2. [4-6号] 隐喻联想：通过意象、氛围来命名
3. [7-9号] 抽象/脑洞：独特的符号化命名

【重要】只返回 JSON 数组，不要任何其他文字、标题或解释。
格式：[{"name":"角色名","tagline":"口头禅","rationale":"理由","style":"Direct/Metaphor/Abstract"}, ...]`
            : `You are a Virtual IP Character Naming Specialist.

Generate 9 names using the Relevance Spectrum strategy:
1. [#1-3] Closely Related - Direct names
2. [#4-6] Associative - Metaphorical names  
3. [#7-9] Abstract - Unique coined names

IMPORTANT: Return ONLY a JSON array, no other text, titles, or explanations.
Format: [{"name":"...","tagline":"...","rationale":"...","style":"Direct/Metaphor/Abstract"}, ...]`;

        const prompt = `
Product Type: ${inputs.productType}
Target Audience: ${inputs.targetAudience || 'General'}
Brand Tone: ${inputs.brandTone || 'Friendly'}

Generate 9 unique IP CHARACTER names following the Spectrum Strategy.
Return as a JSON array.`;

        // Get the mixin's execute function
        const llmRecipe = getRecipe('llm.call');
        if (!llmRecipe) {
            return { success: false, error: 'LLM recipe not found' };
        }

        // Call the mixin with our customized prompts
        const result = await llmRecipe.execute({
            ...ctx,
            inputs: {
                ...inputs,
                prompt,
                systemPrompt: systemInstruction,
                temperature: inputs.temperature ?? 0.9,
                maxTokens: inputs.maxTokens ?? 4096
            }
        });

        // Parse JSON response and create docked nodes
        if (result.success && result.data?.response) {
            try {
                // Extract JSON from markdown code blocks or raw text
                const rawResponse = result.data.response;
                let jsonText = rawResponse;

                // Try to extract from ```json ... ``` block
                const jsonBlockMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                    jsonText = jsonBlockMatch[1];
                } else {
                    // Try to find JSON array directly
                    const arrayMatch = rawResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (arrayMatch) {
                        jsonText = arrayMatch[0];
                    }
                }

                const names = JSON.parse(jsonText);

                if (Array.isArray(names) && names.length > 0) {
                    // Schema for each naming option
                    const namingSchema = [
                        { id: 'name', key: 'name', label: 'Name', type: 'string' as const, connection: { output: true } },
                        { id: 'tagline', key: 'tagline', label: 'Tagline', type: 'string' as const, connection: { output: true } },
                        { id: 'rationale', key: 'rationale', label: 'Rationale', type: 'string' as const },
                        { id: 'style', key: 'style', label: 'Style', type: 'string' as const, connection: { output: true } }
                    ];

                    // Create docked JSON nodes for each naming option
                    const createNodes = names.map((item: any, index: number) => ({
                        type: NodeType.JSON,
                        data: {
                            title: `#${index + 1}: ${item.name || 'Unnamed'}`,
                            assetType: 'json' as const,
                            content: {
                                schema: namingSchema,
                                values: {
                                    name: item.name || '',
                                    tagline: item.tagline || '',
                                    rationale: item.rationale || '',
                                    style: item.style || ''
                                }
                            }
                        },
                        position: index === 0 ? 'below' as const : undefined,
                        dockedTo: index > 0 ? '$prev' as const : undefined,
                        connectTo: index === 0 ? { sourceHandle: 'response', targetHandle: 'input' } : undefined
                    }));

                    return {
                        success: true,
                        data: { names, response: result.data.response },
                        createNodes
                    } as unknown as ExecutionResult;
                }

                // Array empty or invalid - return raw
                return {
                    success: true,
                    data: { names, response: result.data.response }
                };
            } catch {
                // JSON parse failed - return raw response
                return result;
            }
        }

        return result;
    }
});
