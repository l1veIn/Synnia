// Output Strategy Tests
// Tests for record vs array output strategies with schema matching

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    inferValueType,
    isSchemaCompatible,
    determineOutputAction,
} from '../outputStrategy';
import type { FieldDefinition } from '@/types/assets';
import { nodeRegistry } from '@core/registry/NodeRegistry';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@core/registry/NodeRegistry', () => ({
    nodeRegistry: {
        isCollection: vi.fn(),
    },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSchema: FieldDefinition[] = [
    { key: 'id', type: 'string', label: 'ID' },
    { key: 'name', type: 'string', label: 'Name' },
    { key: 'email', type: 'string', label: 'Email' },
];

const mockAsset = {
    id: 'asset-123',
    config: {
        schema: mockSchema,
    },
};

// ============================================================================
// Tests
// ============================================================================

describe('outputStrategy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('inferValueType', () => {
        it('should return explicit valueType when provided', () => {
            const result = inferValueType('form', 'array');
            expect(result).toBe('array');
            expect(nodeRegistry.isCollection).not.toHaveBeenCalled();
        });

        it('should return "array" for collection node types from registry', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(true);

            const result = inferValueType('gallery');

            expect(result).toBe('array');
            expect(nodeRegistry.isCollection).toHaveBeenCalledWith('gallery');
        });

        it('should return "record" for non-collection node types from registry', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('form');

            expect(result).toBe('record');
            expect(nodeRegistry.isCollection).toHaveBeenCalledWith('form');
        });

        it('should return "array" for gallery when registry unavailable', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('gallery');

            expect(result).toBe('array');
        });

        it('should return "array" for table when registry unavailable', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('table');

            expect(result).toBe('array');
        });

        it('should return "array" for selector when registry unavailable', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('selector');

            expect(result).toBe('array');
        });

        it('should return "record" for form node type', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('form');

            expect(result).toBe('record');
        });

        it('should return "record" for text node type', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('text');

            expect(result).toBe('record');
        });

        it('should return "record" for unknown node types', () => {
            vi.mocked(nodeRegistry.isCollection).mockReturnValue(false);

            const result = inferValueType('unknownType');

            expect(result).toBe('record');
        });
    });

    describe('isSchemaCompatible', () => {
        it('should return true when existingSchema is undefined', () => {
            const result = isSchemaCompatible(undefined, { id: 1, name: 'test' });
            expect(result).toBe(true);
        });

        it('should return true when existingSchema is empty array', () => {
            const result = isSchemaCompatible([], { id: 1, name: 'test' });
            expect(result).toBe(true);
        });

        it('should return false when newData is null', () => {
            const result = isSchemaCompatible(mockSchema, null);
            expect(result).toBe(false);
        });

        it('should return false when newData is undefined', () => {
            const result = isSchemaCompatible(mockSchema, undefined);
            expect(result).toBe(false);
        });

        it('should return false when newData is not an object', () => {
            const result = isSchemaCompatible(mockSchema, 'string');
            expect(result).toBe(false);
        });

        it('should return true when newData is empty array', () => {
            const result = isSchemaCompatible(mockSchema, []);
            expect(result).toBe(true);
        });

        it('should return true when array sample is null', () => {
            const result = isSchemaCompatible(mockSchema, [null]);
            expect(result).toBe(true);
        });

        it('should return true when array sample is primitive', () => {
            const result = isSchemaCompatible(mockSchema, ['string']);
            expect(result).toBe(true);
        });

        it('should return true when all keys match schema exactly', () => {
            const newData = { id: '1', name: 'Test', email: 'test@example.com' };
            const result = isSchemaCompatible(mockSchema, newData);
            expect(result).toBe(true);
        });

        it('should return true when array item matches schema exactly', () => {
            const newData = [{ id: '1', name: 'Test', email: 'test@example.com' }];
            const result = isSchemaCompatible(mockSchema, newData);
            expect(result).toBe(true);
        });

        it('should return true when 50% of keys match schema (threshold)', () => {
            // 3 keys in schema, 2 in data = need at least 1 to match (ceil(2 * 0.5) = 1)
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
                { key: 'email', type: 'string' },
            ];
            const newData = { id: '1', unknownField: 'value' };
            const result = isSchemaCompatible(schema, newData);
            expect(result).toBe(true);
        });

        it('should return true when more than 50% of keys match', () => {
            // 4 keys in data, 2 match = 50%, need >= 50%, so should pass (ceil(4 * 0.5) = 2)
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
                { key: 'email', type: 'string' },
            ];
            const newData = { id: '1', name: 'Test', unknown1: 'a', unknown2: 'b' };
            const result = isSchemaCompatible(schema, newData);
            expect(result).toBe(true);
        });

        it('should return false when less than 50% of keys match', () => {
            // 3 keys in data, 1 matches = 33%, need >= 50%
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
            ];
            const newData = { id: '1', unknown1: 'a', unknown2: 'b' };
            const result = isSchemaCompatible(schema, newData);
            expect(result).toBe(false);
        });

        it('should return false when no keys match schema', () => {
            const newData = { unknown1: 'a', unknown2: 'b', unknown3: 'c' };
            const result = isSchemaCompatible(mockSchema, newData);
            expect(result).toBe(false);
        });

        it('should handle nested objects in array', () => {
            const newData = [{ id: '1', name: 'Test', extra: { nested: true } }];
            const result = isSchemaCompatible(mockSchema, newData);
            // Only checks top-level keys: id, name, extra
            // 2/3 match = 66% >= 50%
            expect(result).toBe(true);
        });

        it('should return true for single element arrays with partial match', () => {
            const newData = [{ id: '1', unknownField: 'value' }];
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
            ];
            const result = isSchemaCompatible(schema, newData);
            // 1/2 match = 50% >= 50% (ceil(2 * 0.5) = 1)
            expect(result).toBe(true);
        });

        it('should handle arrays with objects at first index only', () => {
            const newData = [{ id: '1', name: 'Test' }, { id: '2' }];
            const result = isSchemaCompatible(mockSchema, newData);
            // Only checks first element: id, name = 100% match
            expect(result).toBe(true);
        });
    });

    describe('determineOutputAction', () => {
        it('should return create action when no existing asset', () => {
            const result = determineOutputAction('record', null, { id: 1 });

            expect(result).toEqual({ type: 'create' });
        });

        it('should return update action for record valueType with existing asset', () => {
            const result = determineOutputAction('record', mockAsset, { id: 1, name: 'Test' });

            expect(result).toEqual({ type: 'update', assetId: 'asset-123' });
        });

        it('should return update action for record regardless of schema compatibility', () => {
            const incompatibleData = { completelyDifferent: 'data' };
            const result = determineOutputAction('record', mockAsset, incompatibleData);

            expect(result).toEqual({ type: 'update', assetId: 'asset-123' });
        });

        it('should return merge action for array valueType with compatible schema', () => {
            const newData = [{ id: '1', name: 'Test', email: 'test@example.com' }];
            const result = determineOutputAction('array', mockAsset, newData);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-123' });
        });

        it('should return create action for array valueType with incompatible schema', () => {
            const incompatibleData = [{ completelyDifferent: 'data', anotherField: 'value' }];
            const result = determineOutputAction('array', mockAsset, incompatibleData);

            expect(result).toEqual({ type: 'create' });
        });

        it('should return merge action for array when schema is undefined', () => {
            const assetWithoutSchema = {
                id: 'asset-456',
                config: {},
            };
            const newData = [{ anything: 'goes' }];
            const result = determineOutputAction('array', assetWithoutSchema, newData);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-456' });
        });

        it('should return merge action for array when config is undefined', () => {
            const assetWithoutConfig = {
                id: 'asset-789',
            };
            const newData = [{ anything: 'goes' }];
            const result = determineOutputAction('array', assetWithoutConfig, newData);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-789' });
        });

        it('should handle empty array data for array valueType', () => {
            const result = determineOutputAction('array', mockAsset, []);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-123' });
        });

        it('should handle primitive array data for array valueType', () => {
            const result = determineOutputAction('array', mockAsset, ['item1', 'item2']);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-123' });
        });

        it('should use first array element for schema compatibility check', () => {
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
            ];
            const asset = {
                id: 'asset-999',
                config: { schema },
            };
            // First element compatible, second doesn't matter
            const newData = [{ id: '1', name: 'Test' }, { totallyDifferent: 'data' }];
            const result = determineOutputAction('array', asset, newData);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-999' });
        });

        it('should return merge for array when exactly 50% threshold is met', () => {
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
            ];
            const asset = {
                id: 'asset-threshold',
                config: { schema },
            };
            // 2 keys, 1 match = 50% (exactly at threshold)
            const newData = [{ id: '1', unknown: 'field' }];
            const result = determineOutputAction('array', asset, newData);

            expect(result).toEqual({ type: 'merge', assetId: 'asset-threshold' });
        });

        it('should return create for array when below 50% threshold', () => {
            const schema: FieldDefinition[] = [
                { key: 'id', type: 'string' },
                { key: 'name', type: 'string' },
            ];
            const asset = {
                id: 'asset-below',
                config: { schema },
            };
            // 3 keys, 1 match = 33% (below threshold)
            const newData = [{ id: '1', unknown1: 'a', unknown2: 'b' }];
            const result = determineOutputAction('array', asset, newData);

            expect(result).toEqual({ type: 'create' });
        });
    });
});
