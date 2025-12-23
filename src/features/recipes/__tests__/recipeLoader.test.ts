// Recipe Loader Tests
// Tests for YAML parsing and recipe creation

import { describe, it, expect, vi } from 'vitest';
import { parseManifest, mergeSchemas } from '../recipeLoader';
import { ManifestField } from '@/types/recipe';
import { FieldDefinition } from '@/types/assets';

describe('parseManifest', () => {
    it('should parse valid YAML with version 1', () => {
        const yaml = `
version: 1
id: test.recipe
name: Test Recipe
description: A test recipe
category: Test
inputSchema:
  - key: prompt
    label: Prompt
    type: string
executor:
  type: template
  template: "{{prompt}}"
`;
        const manifest = parseManifest(yaml);

        expect(manifest.version).toBe(1);
        expect(manifest.id).toBe('test.recipe');
        expect(manifest.name).toBe('Test Recipe');
        expect(manifest.description).toBe('A test recipe');
        expect(manifest.category).toBe('Test');
        expect(manifest.inputSchema).toHaveLength(1);
        expect(manifest.inputSchema[0].key).toBe('prompt');
        expect(manifest.executor.type).toBe('template');
    });

    it('should throw on missing id', () => {
        const yaml = `
version: 1
name: Test
inputSchema: []
executor:
  type: template
  template: ""
`;
        expect(() => parseManifest(yaml)).toThrow('missing "id"');
    });

    it('should throw on missing name', () => {
        const yaml = `
version: 1
id: test
inputSchema: []
executor:
  type: template
  template: ""
`;
        expect(() => parseManifest(yaml)).toThrow('missing "name"');
    });

    it('should throw on missing inputSchema', () => {
        const yaml = `
version: 1
id: test
name: Test
executor:
  type: template
  template: ""
`;
        expect(() => parseManifest(yaml)).toThrow('missing "inputSchema"');
    });

    it('should throw on missing executor', () => {
        const yaml = `
version: 1
id: test
name: Test
inputSchema: []
`;
        expect(() => parseManifest(yaml)).toThrow('missing "executor"');
    });

    it('should warn on unknown version', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const yaml = `
version: 99
id: test
name: Test
inputSchema: []
executor:
  type: template
  template: ""
`;
        parseManifest(yaml);

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('unknown version: 99')
        );

        warnSpy.mockRestore();
    });

    it('should parse complex inputSchema', () => {
        const yaml = `
version: 1
id: complex.recipe
name: Complex
inputSchema:
  - key: text
    label: Text Input
    type: string
    widget: textarea
    required: true
    placeholder: "Enter text..."
    connection:
      input: true
      output: true
  - key: config
    label: Configuration
    type: object
    widget: json-input
executor:
  type: template
  template: "{{text}}"
`;
        const manifest = parseManifest(yaml);

        expect(manifest.inputSchema).toHaveLength(2);

        const textField = manifest.inputSchema[0];
        expect(textField.key).toBe('text');
        expect(textField.widget).toBe('textarea');
        expect(textField.required).toBe(true);
        expect(textField.connection?.input).toBe(true);
        expect(textField.connection?.output).toBe(true);

        const configField = manifest.inputSchema[1];
        expect(configField.type).toBe('object');
        expect(configField.widget).toBe('json-input');
    });
});

describe('mergeSchemas', () => {
    it('should merge mixin fields with recipe fields', () => {
        const mixinFields: FieldDefinition[] = [
            {
                id: 'field-1',
                key: 'mixinField',
                label: 'Mixin Field',
                type: 'string',
            },
        ];

        const recipeFields: ManifestField[] = [
            {
                key: 'recipeField',
                label: 'Recipe Field',
                type: 'string',
            },
        ];

        const merged = mergeSchemas(recipeFields, [mixinFields]);

        expect(merged).toHaveLength(2);
        expect(merged.find(f => f.key === 'mixinField')).toBeDefined();
        expect(merged.find(f => f.key === 'recipeField')).toBeDefined();
    });

    it('should allow recipe fields to override mixin fields', () => {
        const mixinFields: FieldDefinition[] = [
            {
                id: 'field-1',
                key: 'sharedField',
                label: 'Mixin Label',
                type: 'string',
                widget: 'textarea', // Valid WidgetType
            },
        ];

        const recipeFields: ManifestField[] = [
            {
                key: 'sharedField',
                type: 'string', // Required field
                label: 'Recipe Label', // Override label
                hidden: true, // Add hidden
            },
        ];

        const merged = mergeSchemas(recipeFields, [mixinFields]);

        expect(merged).toHaveLength(1);
        const field = merged[0];
        expect(field.key).toBe('sharedField');
        expect(field.label).toBe('Recipe Label'); // Overridden
        expect(field.hidden).toBe(true); // Added
        // Note: widget may or may not be preserved depending on manifestFieldToDefinition behavior
    });

    it('should preserve order: mixin fields first, then recipe fields', () => {
        const mixinFields: FieldDefinition[] = [
            { id: '1', key: 'a', label: 'A', type: 'string' },
            { id: '2', key: 'b', label: 'B', type: 'string' },
        ];

        const recipeFields: ManifestField[] = [
            { key: 'c', label: 'C', type: 'string' },
        ];

        const merged = mergeSchemas(recipeFields, [mixinFields]);
        const keys = merged.map(f => f.key);

        expect(keys).toEqual(['a', 'b', 'c']);
    });
});
