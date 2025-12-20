#!/usr/bin/env node
/**
 * Generate Node Configuration Documentation
 * 
 * Run: pnpm gen:node-docs
 * 
 * Features:
 * - Extracts assetContentSchema from node definition files
 * - Auto-parses TypeScript interfaces for referenced types
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '../src');
const nodesDir = join(srcDir, 'components/workflow/nodes');
const outputPath = join(srcDir, 'lib/recipes/NODE_CONFIG.md');

interface FieldDoc {
    name: string;
    type: string;
    description?: string;
    default?: string;
    required?: boolean;
    itemType?: string;
}

interface NodeDoc {
    type: string;
    alias?: string;
    title: string;
    description?: string;
    category: string;
    fields: FieldDoc[];
}

// Type location mapping - where to find each interface
const TYPE_LOCATIONS: Record<string, string> = {
    'FieldDefinition': 'types/assets.ts',
    'TableColumn': 'components/workflow/nodes/TableNode/index.tsx',
    'GalleryImage': 'components/workflow/nodes/GalleryNode/index.tsx',
    'SelectorOption': 'components/workflow/nodes/SelectorNode/index.tsx',
    'QueueTask': 'components/workflow/nodes/QueueNode/index.tsx',
};

const nodeNames = ['SelectorNode', 'TableNode', 'GalleryNode', 'JSONNode', 'TextNode', 'ImageNode', 'QueueNode'];

/**
 * Parse a TypeScript interface definition from file content
 */
function parseInterface(content: string, interfaceName: string): FieldDoc[] {
    // Find interface definition
    const regex = new RegExp(`(?:export\\s+)?interface\\s+${interfaceName}\\s*\\{([^}]+)\\}`, 's');
    const match = content.match(regex);
    if (!match) return [];

    const body = match[1];
    const fields: FieldDoc[] = [];

    // Parse each line
    const lines = body.split('\n');
    for (const line of lines) {
        // Match: fieldName: type; or fieldName?: type;
        const fieldMatch = line.match(/^\s*(\w+)(\?)?:\s*(.+?);?\s*(\/\/.*)?$/);
        if (fieldMatch) {
            const name = fieldMatch[1];
            const optional = fieldMatch[2] === '?';
            let type = fieldMatch[3].trim().replace(/;$/, '');
            const comment = fieldMatch[4]?.replace('//', '').trim();

            // Clean up type
            type = type
                .replace(/Record<string,\s*any>/g, 'object')
                .replace(/<[^>]+>/g, '')
                .replace(/\s*\|\s*undefined/g, '')
                .replace(/\s*\|\s*null/g, '');

            fields.push({
                name,
                type,
                required: !optional,
                description: comment,
            });
        }
    }

    return fields;
}

function extractNodeInfo(content: string): NodeDoc | null {
    const typeMatch = content.match(/type:\s*NodeType\.(\w+)/);
    const aliasMatch = content.match(/createNodeAlias:\s*['"]([\w]+)['"]/);
    const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
    const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
    const catMatch = content.match(/category:\s*['"](\w+)['"]/);

    if (!typeMatch || !titleMatch) return null;

    const schemaStart = content.indexOf('assetContentSchema:');
    const fields: FieldDoc[] = [];

    if (schemaStart !== -1) {
        let braceStart = content.indexOf('{', schemaStart);
        if (braceStart !== -1) {
            let braceCount = 1;
            let i = braceStart + 1;
            while (i < content.length && braceCount > 0) {
                if (content[i] === '{') braceCount++;
                else if (content[i] === '}') braceCount--;
                i++;
            }

            const schemaContent = content.slice(braceStart + 1, i - 1);
            const lines = schemaContent.split('\n');

            for (const line of lines) {
                const fieldMatch = line.match(/^\s*(\w+):\s*\{(.+)\}/);
                if (fieldMatch) {
                    const name = fieldMatch[1];
                    const props = fieldMatch[2];

                    const typeM = props.match(/type:\s*['"](\w+)['"]/);
                    const descM = props.match(/description:\s*['"]([^'"]+)['"]/);
                    const defaultM = props.match(/default:\s*([^,}]+)/);
                    const requiredM = props.match(/required:\s*(true|false)/);
                    const itemTypeM = props.match(/itemType:\s*['"](\w+)['"]/);

                    let type = typeM?.[1] || 'unknown';
                    let itemType = itemTypeM?.[1];
                    if (type === 'array' && itemType) {
                        type = `${itemType}[]`;
                    }

                    fields.push({
                        name,
                        type,
                        description: descM?.[1],
                        default: defaultM?.[1]?.trim().replace(/^['"]|['"]$/g, ''),
                        required: requiredM?.[1] === 'true',
                        itemType,
                    });
                }
            }
        }
    }

    return {
        type: typeMatch[1],
        alias: aliasMatch?.[1],
        title: titleMatch[1],
        description: descMatch?.[1],
        category: catMatch?.[1] || 'Asset',
        fields,
    };
}

function collectReferencedTypes(docs: NodeDoc[]): Set<string> {
    const referenced = new Set<string>();
    for (const doc of docs) {
        for (const field of doc.fields) {
            if (field.itemType && TYPE_LOCATIONS[field.itemType]) {
                referenced.add(field.itemType);
            }
            const baseType = field.type.replace('[]', '');
            if (TYPE_LOCATIONS[baseType]) {
                referenced.add(baseType);
            }
        }
    }
    return referenced;
}

function loadTypeDefinition(typeName: string): FieldDoc[] {
    const relativePath = TYPE_LOCATIONS[typeName];
    if (!relativePath) return [];

    const fullPath = join(srcDir, relativePath);
    if (!existsSync(fullPath)) {
        console.warn(`Warning: Type file not found: ${fullPath}`);
        return [];
    }

    try {
        const content = readFileSync(fullPath, 'utf-8');
        return parseInterface(content, typeName);
    } catch (e) {
        console.warn(`Warning: Could not parse ${typeName}`);
        return [];
    }
}

function generateMarkdown(docs: NodeDoc[]): string {
    const referencedTypes = collectReferencedTypes(docs);

    let md = `# Node Output Configuration Reference

> **Auto-generated** by \`pnpm gen:node-docs\`

This document describes how to configure \`nodeConfig\` in recipe YAML files.

---

## Quick Reference

| Type | Alias | Description |
|------|-------|-------------|
`;

    for (const doc of docs) {
        if (doc.alias) {
            md += `| ${doc.title} | \`${doc.alias}\` | ${doc.description || '-'} |\n`;
        }
    }

    md += `
---

## Node Types

`;

    for (const doc of docs) {
        if (!doc.alias) continue;

        md += `### ${doc.title} (\`type: ${doc.alias}\`)

**Category:** ${doc.category}  
`;
        if (doc.description) {
            md += `**Description:** ${doc.description}\n`;
        }
        md += '\n';

        if (doc.fields.length > 0) {
            md += '#### Content Fields\n\n';
            md += '| Field | Type | Required | Default | Description |\n';
            md += '|-------|------|----------|---------|-------------|\n';
            for (const field of doc.fields) {
                const required = field.required ? '✓' : '';
                const defaultVal = field.default ? `\`${field.default}\`` : '-';
                const desc = field.description || '-';
                const typeDisplay = field.itemType && TYPE_LOCATIONS[field.itemType]
                    ? `[\`${field.type}\`](#${field.itemType.toLowerCase()})`
                    : `\`${field.type}\``;
                md += `| ${field.name} | ${typeDisplay} | ${required} | ${defaultVal} | ${desc} |\n`;
            }
            md += '\n';
        }

        md += '---\n\n';
    }

    // Document referenced types (auto-parsed from source)
    if (referencedTypes.size > 0) {
        md += `## Type Definitions

The following types are auto-parsed from TypeScript source files.

`;
        for (const typeName of referencedTypes) {
            const fields = loadTypeDefinition(typeName);
            if (fields.length === 0) continue;

            const sourceFile = TYPE_LOCATIONS[typeName];
            md += `### ${typeName}

> Source: \`${sourceFile}\`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
`;
            for (const field of fields) {
                const required = field.required ? '✓' : '';
                md += `| ${field.name} | \`${field.type}\` | ${required} | ${field.description || '-'} |\n`;
            }
            md += '\n';
        }
        md += '---\n\n';
    }

    md += `## nodeConfig Usage

\`\`\`yaml
output:
  createNodes: true
  nodeConfig:
    type: json | table | gallery | selector | text | image
    schema: auto | FieldDef[]
    titleTemplate: string
    collapsed: boolean
\`\`\`

### Title Template Variables
- \`{{count}}\` - Number of items (for table/gallery/selector)
- \`{{index}}\` - 1-based index (for json type)
- \`{{fieldName}}\` - Value from data field

### Example

\`\`\`yaml
nodeConfig:
  type: selector
  titleTemplate: "Options ({{count}})"
  collapsed: false
\`\`\`
`;

    return md;
}

// Main
const docs: NodeDoc[] = [];

for (const nodeName of nodeNames) {
    const filePath = join(nodesDir, nodeName, 'index.tsx');
    try {
        const content = readFileSync(filePath, 'utf-8');
        const doc = extractNodeInfo(content);
        if (doc) {
            docs.push(doc);
        }
    } catch (e) {
        console.warn(`Warning: Could not read ${nodeName}`);
    }
}

const markdown = generateMarkdown(docs);
writeFileSync(outputPath, markdown, 'utf-8');

console.log(`✓ Generated: ${outputPath}`);
console.log(`  Documented ${docs.length} node types (${docs.filter(d => d.alias).length} with aliases)`);
