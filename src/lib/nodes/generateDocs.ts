/**
 * Node Configuration Documentation Generator
 * 
 * Generates markdown documentation for recipe authors based on registered NodeDefinitions.
 * 
 * Usage: 
 *   import { generateNodeDocs } from './generateDocs';
 *   const markdown = generateNodeDocs();
 */

import { nodeRegistry } from '@/lib/nodes/NodeRegistry';
import '@/components/workflow/nodes'; // Ensure nodes are registered

export function generateNodeDocs(): string {
    const docs = nodeRegistry.generateConfigDocs();

    let md = '# Node Configuration Reference\n\n';
    md += 'This document describes all available node types and their configuration options for recipe authors.\n\n';
    md += '---\n\n';

    for (const doc of docs) {
        md += `## ${doc.title}\n\n`;
        md += `**Type:** \`${doc.type}\`\n`;
        if (doc.alias) {
            md += `**Alias:** \`${doc.alias}\` (use in recipe nodeConfig.type)\n`;
        }
        md += `**Category:** ${doc.category}\n`;
        if (doc.description) {
            md += `**Description:** ${doc.description}\n`;
        }
        md += `**Requires Asset:** ${doc.requiresAsset ? 'Yes' : 'No'}\n`;
        if (doc.defaultAssetType) {
            md += `**Default Asset Type:** \`${doc.defaultAssetType}\`\n`;
        }
        md += '\n';

        if (doc.contentFields.length > 0) {
            md += '### Content Fields\n\n';
            md += '| Field | Type | Required | Default | Description |\n';
            md += '|-------|------|----------|---------|-------------|\n';
            for (const field of doc.contentFields) {
                const required = field.required ? '✓' : '';
                const defaultVal = field.default !== undefined ? `\`${JSON.stringify(field.default)}\`` : '-';
                const desc = field.description || '-';
                md += `| ${field.name} | \`${field.type}\` | ${required} | ${defaultVal} | ${desc} |\n`;
            }
            md += '\n';
        }

        md += '---\n\n';
    }

    return md;
}

/**
 * Get documentation as JSON for programmatic use
 */
export function getNodeDocsJSON() {
    return nodeRegistry.generateConfigDocs();
}
