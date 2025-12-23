/**
 * Node Configuration Documentation Generator
 * 
 * Generates markdown documentation for recipe authors based on registered NodeDefinitions.
 * 
 * Usage: 
 *   import { generateNodeDocs } from './generateDocs';
 *   const markdown = generateNodeDocs();
 */

import { nodeRegistry } from '@core/registry/NodeRegistry';
import '@/components/workflow/nodes'; // Ensure nodes are registered

export interface NodeDocEntry {
    type: string;
    title: string;
    alias?: string;
    category: string;
    description?: string;
}

export function generateNodeDocs(): string {
    const allMetas = nodeRegistry.getAllMetas();

    let md = '# Node Configuration Reference\n\n';
    md += 'This document describes all available node types and their configuration options for recipe authors.\n\n';
    md += '---\n\n';

    for (const [type, meta] of Object.entries(allMetas)) {
        if (type.startsWith('recipe:')) continue;
        if (meta.hidden) continue;

        md += `## ${meta.title}\n\n`;
        md += `**Type:** \`${type}\`\n`;
        if (meta.alias) {
            md += `**Alias:** \`${meta.alias}\` (use in recipe output.node)\\n`;
        }
        md += `**Category:** ${meta.category || 'Basic'}\n`;
        if (meta.description) {
            md += `**Description:** ${meta.description}\n`;
        }
        md += '\n';
        md += '---\n\n';
    }

    return md;
}

/**
 * Get documentation as JSON for programmatic use
 */
export function getNodeDocsJSON(): NodeDocEntry[] {
    const allMetas = nodeRegistry.getAllMetas();
    return Object.entries(allMetas)
        .filter(([type, meta]) => !type.startsWith('recipe:') && !meta.hidden)
        .map(([type, meta]) => ({
            type,
            title: meta.title,
            alias: meta.alias,
            category: meta.category || 'Basic',
            description: meta.description,
        }));
}
