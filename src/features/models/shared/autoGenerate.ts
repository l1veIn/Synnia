// Auto-Generate Service
// High-level service for node content generation

import { callLLM } from '../llm/registry';

export interface AutoGenerateOptions {
    mode: 'text' | 'json-complete' | 'table-rows' | 'table-full' | 'form-autofill';
    prompt: string;
    existingContent?: string;
    schema?: { key: string; label: string; type: string }[];
    // For form-autofill: complete field definitions with placeholder, etc.
    formSchema?: { key: string; label?: string; type: string; placeholder?: string; widget?: string; options?: string[] }[];
    count?: number;  // For table rows
    providerId?: string;
}

export interface AutoGenerateResult {
    success: boolean;
    content?: any;
    error?: string;
}

/**
 * Generate text content
 */
async function generateText(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    const systemPrompt = options.existingContent
        ? 'You are a helpful writing assistant. Continue or expand the given content based on the user\'s instructions. Only output the generated text, no explanations.'
        : 'You are a helpful writing assistant. Generate content based on the user\'s instructions. Only output the generated text, no explanations.';

    const userPrompt = options.existingContent
        ? `Current content:\n${options.existingContent}\n\nInstruction: ${options.prompt}`
        : options.prompt;

    const response = await callLLM({
        systemPrompt,
        userPrompt,
        providerId: options.providerId,
    });

    if (response.success && response.text) {
        return { success: true, content: response.text };
    }

    return { success: false, error: response.error || 'Generation failed' };
}

/**
 * Generate table rows based on schema
 */
async function generateTableRows(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    if (!options.schema || options.schema.length === 0) {
        return { success: false, error: 'Table schema is required for row generation' };
    }

    const count = options.count || 20;
    const schemaDescription = options.schema
        .map(col => `- ${col.key} (${col.type}): ${col.label}`)
        .join('\n');

    const systemPrompt = `You are a data generation assistant. Generate table rows in JSON array format.
Each row should be an object with the exact keys specified in the schema.
Only output the JSON array, no explanations or markdown formatting.`;

    const userPrompt = `Generate up to ${count} rows for a table with the following schema:
${schemaDescription}

User instruction: ${options.prompt}

Generate as many rows as appropriate based on the user's input, up to the maximum of ${count}.
Output format: [{"key1": "value1", ...}, ...]`;

    const response = await callLLM({
        systemPrompt,
        userPrompt,
        parseAs: 'json',
        providerId: options.providerId,
        maxTokens: Math.max(65536, count * 500), // Modern models support longer context
    });

    if (response.success && response.data) {
        // Ensure we have an array
        const rows = Array.isArray(response.data) ? response.data : [response.data];
        return { success: true, content: rows };
    }

    return { success: false, error: response.error || 'Failed to generate table rows' };
}

/**
 * Generate complete table with columns and rows
 */
async function generateTableFull(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    const count = options.count || 20;

    const systemPrompt = `You are a data structure designer. Generate a complete table structure with columns (schema) and sample rows.
Output a JSON object with two fields:
- "columns": array of column definitions, each with "key" (snake_case), "label" (display name), "type" ("string" or "number")
- "rows": array of data rows matching the columns
Only output the JSON object, no explanations or markdown formatting.`;

    const userPrompt = `Design a table and generate up to ${count} sample rows based on:
${options.prompt}

Generate as many rows as appropriate based on the description, up to the maximum of ${count}.

Output format:
{
  "columns": [{"key": "field_name", "label": "Field Name", "type": "string"}, ...],
  "rows": [{"field_name": "value", ...}, ...]
}`;

    const response = await callLLM({
        systemPrompt,
        userPrompt,
        parseAs: 'json',
        providerId: options.providerId,
        maxTokens: Math.max(65536, count * 500),
    });

    if (response.success && response.data) {
        const { columns, rows } = response.data;
        if (Array.isArray(columns) && Array.isArray(rows)) {
            return { success: true, content: { columns, rows } };
        }
        return { success: false, error: 'Invalid response format: expected columns and rows arrays' };
    }

    return { success: false, error: response.error || 'Failed to generate table' };
}

/**
 * Complete JSON fields based on schema
 */
async function completeJson(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    const systemPrompt = `You are a data completion assistant. Complete the JSON object based on the context.
Only output the completed JSON object, no explanations or markdown formatting.`;

    const userPrompt = options.existingContent
        ? `Complete or improve this JSON:\n${options.existingContent}\n\nInstruction: ${options.prompt}`
        : `Generate a JSON object. Instruction: ${options.prompt}`;

    const response = await callLLM({
        systemPrompt,
        userPrompt,
        parseAs: 'json',
        providerId: options.providerId,
    });

    if (response.success && response.data) {
        return { success: true, content: response.data };
    }

    return { success: false, error: response.error || 'Failed to complete JSON' };
}

/**
 * Auto-fill form fields based on schema with placeholders
 */
async function autofillForm(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    if (!options.formSchema || options.formSchema.length === 0) {
        return { success: false, error: 'Form schema is required for autofill' };
    }

    // Build rich schema description including placeholder hints
    const schemaDescription = options.formSchema
        .filter(f => !['none'].includes(f.widget || ''))
        .map(f => {
            let desc = `- ${f.key}`;
            if (f.label) desc += ` ("${f.label}")`;
            desc += `: ${f.type}`;
            if (f.placeholder) desc += ` - hint: "${f.placeholder}"`;
            if (f.options?.length) desc += ` - options: [${f.options.join(', ')}]`;
            return desc;
        })
        .join('\n');

    const systemPrompt = `You are a form auto-fill assistant. Generate appropriate values for each field based on the schema and user instructions.
Output a JSON object with field keys and their values. Only output the JSON, no explanations.`;

    const userPrompt = `Fill the following form fields:
${schemaDescription}

User instruction: ${options.prompt}

Output format: {"field_key": "value", ...}`;

    const response = await callLLM({
        systemPrompt,
        userPrompt,
        parseAs: 'json',
        providerId: options.providerId,
    });

    if (response.success && response.data) {
        return { success: true, content: response.data };
    }

    return { success: false, error: response.error || 'Failed to autofill form' };
}

/**
 * Main auto-generate function
 */
export async function autoGenerate(options: AutoGenerateOptions): Promise<AutoGenerateResult> {
    switch (options.mode) {
        case 'text':
            return generateText(options);
        case 'table-rows':
            return generateTableRows(options);
        case 'table-full':
            return generateTableFull(options);
        case 'json-complete':
            return completeJson(options);
        case 'form-autofill':
            return autofillForm(options);
        default:
            return { success: false, error: `Unknown mode: ${options.mode}` };
    }
}

