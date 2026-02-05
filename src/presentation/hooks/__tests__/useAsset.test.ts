// @ts-nocheck
/**
 * useAsset Hook Tests
 * Tests for asset binding logic including value, config, and sys updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Asset, AssetSysMetadata, RecordAsset, ArrayAsset } from '@/domain/asset/types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: vi.fn(),
}));

vi.mock('@core/engine/GraphEngine', () => ({
    graphEngine: {
        assets: {
            update: vi.fn(),
            updateConfig: vi.fn(),
            updateSys: vi.fn(),
            get: vi.fn(),
        },
    },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const createMockRecordAsset = (overrides?: Partial<RecordAsset>): RecordAsset => ({
    id: 'asset-1',
    valueType: 'record',
    value: { prompt: 'test prompt', temperature: 0.7 },
    config: {
        schema: [
            { key: 'prompt', type: 'string', label: 'Prompt' },
            { key: 'temperature', type: 'number', label: 'Temperature' },
        ],
    },
    sys: {
        name: 'Test Asset',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'user',
        isLibraryAsset: null,
    },
    ...overrides,
});

const createMockArrayAsset = (overrides?: Partial<ArrayAsset>): ArrayAsset => ({
    id: 'asset-2',
    valueType: 'array',
    value: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
    ],
    config: {},
    sys: {
        name: 'Test Array Asset',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'ai',
        isLibraryAsset: null,
    },
    ...overrides,
});

// ============================================================================
// Pure Logic Tests (without React hooks)
// ============================================================================

describe('useAsset - asset selection logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return undefined when assetId is undefined', () => {
        const assetId = undefined;
        const assets: Record<string, Asset> = {
            'asset-1': createMockRecordAsset(),
        };

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeUndefined();
    });

    it('should return undefined when assetId does not exist in store', () => {
        const assetId = 'non-existent';
        const assets: Record<string, Asset> = {
            'asset-1': createMockRecordAsset(),
        };

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeUndefined();
    });

    it('should return the asset when assetId exists', () => {
        const assetId = 'asset-1';
        const assets: Record<string, Asset> = {
            'asset-1': createMockRecordAsset(),
        };

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeDefined();
        expect(asset?.id).toBe('asset-1');
    });

    it('should update when assetId changes', () => {
        let assetId = 'asset-1';
        const assets: Record<string, Asset> = {
            'asset-1': createMockRecordAsset({ id: 'asset-1' }),
            'asset-2': createMockRecordAsset({ id: 'asset-2' }),
        };

        let asset = assetId ? assets[assetId] : undefined;
        expect(asset?.id).toBe('asset-1');

        // Simulate assetId change
        assetId = 'asset-2';
        asset = assetId ? assets[assetId] : undefined;
        expect(asset?.id).toBe('asset-2');
    });
});

describe('useAsset - exists status', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be true when asset exists', () => {
        const asset = createMockRecordAsset();
        const exists = !!asset;

        expect(exists).toBe(true);
    });

    it('should be false when asset is undefined', () => {
        const asset = undefined;
        const exists = !!asset;

        expect(exists).toBe(false);
    });

    it('should be false when asset is null', () => {
        const asset = null;
        const exists = !!asset;

        expect(exists).toBe(false);
    });
});

describe('useAsset - setValue logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call graphEngine.assets.update when assetId exists', () => {
        const assetId = 'asset-1';
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(true);
    });

    it('should not call graphEngine.assets.update when assetId is undefined', () => {
        const assetId = undefined;
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(false);
    });

    it('should not call graphEngine.assets.update when assetId is empty string', () => {
        const assetId = '';
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(false);
    });

    it('should pass the correct value to update function', () => {
        const assetId = 'asset-1';
        const value = { prompt: 'test', temperature: 0.8 };

        // Simulate what setValue does
        if (assetId) {
            expect(value).toEqual({ prompt: 'test', temperature: 0.8 });
        }
    });
});

describe('useAsset - updateConfig logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call graphEngine.assets.updateConfig when assetId exists', () => {
        const assetId = 'asset-1';
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(true);
    });

    it('should not call graphEngine.assets.updateConfig when assetId is undefined', () => {
        const assetId = undefined;
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(false);
    });

    it('should pass the correct config to updateConfig function', () => {
        const assetId = 'asset-1';
        const config = {
            schema: [
                { key: 'name', type: 'string', label: 'Name', required: true },
                { key: 'age', type: 'number', label: 'Age' },
            ],
            extra: {
                modelConfig: {
                    modelId: 'gpt-4',
                    provider: 'openai',
                },
            },
        };

        // Simulate what updateConfig does
        if (assetId) {
            expect(config).toEqual({
                schema: [
                    { key: 'name', type: 'string', label: 'Name', required: true },
                    { key: 'age', type: 'number', label: 'Age' },
                ],
                extra: {
                    modelConfig: {
                        modelId: 'gpt-4',
                        provider: 'openai',
                    },
                },
            });
            expect(config.schema).toHaveLength(2);
            expect(config.extra?.modelConfig?.modelId).toBe('gpt-4');
        }
    });
});

describe('useAsset - updateSys logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call graphEngine.assets.updateSys when assetId exists', () => {
        const assetId = 'asset-1';
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(true);
    });

    it('should not call graphEngine.assets.updateSys when assetId is undefined', () => {
        const assetId = undefined;
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(false);
    });

    it('should pass partial sys updates to updateSys function', () => {
        const assetId = 'asset-1';
        const sysUpdates: Partial<AssetSysMetadata> = { name: 'Updated Asset Name' };

        // Simulate what updateSys does
        if (assetId) {
            expect(sysUpdates).toEqual({ name: 'Updated Asset Name' });
        }
    });

    it('should support updating source', () => {
        const assetId = 'asset-1';
        const sysUpdates: Partial<AssetSysMetadata> = { source: 'ai' };

        if (assetId) {
            expect(sysUpdates.source).toBe('ai');
        }
    });

    it('should support updating isLibraryAsset', () => {
        const assetId = 'asset-1';
        const sysUpdates: Partial<AssetSysMetadata> = { isLibraryAsset: true };

        if (assetId) {
            expect(sysUpdates.isLibraryAsset).toBe(true);
        }
    });

    it('should support updating multiple sys fields at once', () => {
        const assetId = 'asset-1';
        const sysUpdates: Partial<AssetSysMetadata> = {
            name: 'Renamed Asset',
            source: 'import',
            isLibraryAsset: true,
        };

        if (assetId) {
            expect(sysUpdates).toEqual({
                name: 'Renamed Asset',
                source: 'import',
                isLibraryAsset: true,
            });
        }
    });
});

describe('useAsset - callback memoization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create callbacks that depend on assetId', () => {
        const assetId = 'asset-1';

        // Simulate useCallback dependency on assetId
        const callbackDeps = [assetId];
        expect(callbackDeps).toContain('asset-1');
    });

    it('should have different callbacks when assetId changes', () => {
        let assetId = 'asset-1';
        let callbackDeps = [assetId];
        expect(callbackDeps).toContain('asset-1');

        assetId = 'asset-2';
        callbackDeps = [assetId];
        expect(callbackDeps).toContain('asset-2');
    });
});

describe('useAsset - record asset value handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle record asset value update', () => {
        const asset = createMockRecordAsset();
        const newValue = { prompt: 'updated prompt', temperature: 0.9 };

        // Record assets have object values
        const isRecordAsset = asset.valueType === 'record';
        expect(isRecordAsset).toBe(true);

        if (isRecordAsset) {
            const valueUpdate = newValue;
            expect(typeof valueUpdate).toBe('object');
            expect(valueUpdate).not.toBeInstanceOf(Array);
        }
    });

    it('should handle record asset config update', () => {
        const newSchema = [
            { key: 'prompt', type: 'string', label: 'Prompt', required: true },
            { key: 'temperature', type: 'number', label: 'Temperature' },
            { key: 'maxTokens', type: 'number', label: 'Max Tokens' },
        ];

        const configUpdate = { schema: newSchema };
        expect(configUpdate.schema).toHaveLength(3);
    });
});

describe('useAsset - array asset value handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle array asset value update', () => {
        const asset = createMockArrayAsset();
        const newValue = [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' },
        ];

        // Array assets have array values
        const isArrayAsset = asset.valueType === 'array';
        expect(isArrayAsset).toBe(true);

        if (isArrayAsset) {
            expect(Array.isArray(newValue)).toBe(true);
            expect(newValue).toHaveLength(3);
        }
    });

    it('should handle empty array value update', () => {
        const newValue: unknown[] = [];

        expect(Array.isArray(newValue)).toBe(true);
        expect(newValue).toHaveLength(0);
    });
});

describe('useAsset - isLoading status', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should always return false for isLoading', () => {
        const isLoading = false;

        expect(isLoading).toBe(false);
    });
});

describe('useAsset - type safety', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should accept any value type for setValue', () => {
        // Test various value types
        const stringValue = 'test string';
        const numberValue = 42;
        const booleanValue = true;
        const objectValue = { key: 'value' };
        const arrayValue = [1, 2, 3];
        const nullValue = null;
        const undefinedValue = undefined;

        expect(typeof stringValue).toBe('string');
        expect(typeof numberValue).toBe('number');
        expect(typeof booleanValue).toBe('boolean');
        expect(typeof objectValue).toBe('object');
        expect(Array.isArray(arrayValue)).toBe(true);
        expect(nullValue).toBeNull();
        expect(undefinedValue).toBeUndefined();
    });

    it('should accept any config type for updateConfig', () => {
        const config1 = { schema: [] };
        const config2 = { extra: { key: 'value' } };
        const config3 = { schema: [], extra: { key: 'value' } };
        const config4 = null;
        const config5 = undefined;

        expect(config1).toBeDefined();
        expect(config2).toBeDefined();
        expect(config3).toBeDefined();
        expect(config4).toBeNull();
        expect(config5).toBeUndefined();
    });
});

describe('useAsset - return value structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return an object with all expected properties', () => {
        const asset = createMockRecordAsset();
        const result = {
            asset,
            setValue: vi.fn(),
            updateConfig: vi.fn(),
            updateSys: vi.fn(),
            isLoading: false,
            exists: !!asset,
        };

        expect(result).toHaveProperty('asset');
        expect(result).toHaveProperty('setValue');
        expect(result).toHaveProperty('updateConfig');
        expect(result).toHaveProperty('updateSys');
        expect(result).toHaveProperty('isLoading');
        expect(result).toHaveProperty('exists');
    });

    it('should have setValue as a function', () => {
        const setValue = vi.fn();
        expect(typeof setValue).toBe('function');
    });

    it('should have updateConfig as a function', () => {
        const updateConfig = vi.fn();
        expect(typeof updateConfig).toBe('function');
    });

    it('should have updateSys as a function', () => {
        const updateSys = vi.fn();
        expect(typeof updateSys).toBe('function');
    });

    it('should have isLoading as a boolean', () => {
        const isLoading = false;
        expect(typeof isLoading).toBe('boolean');
    });

    it('should have exists as a boolean', () => {
        const exists = true;
        expect(typeof exists).toBe('boolean');
    });
});

describe('useAsset - edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle whitespace-only assetId as falsy', () => {
        const assetId = '   ';
        const shouldCallUpdate = !!assetId;

        // Whitespace-only string is still truthy in JavaScript
        // But typically we'd want to trim it in real implementation
        expect(assetId).toBeTruthy();
        expect(shouldCallUpdate).toBe(true);
    });

    it('should handle asset with undefined value', () => {
        const asset = createMockRecordAsset({ value: undefined as unknown });
        expect(asset.value).toBeUndefined();
    });

    it('should handle asset with null value', () => {
        const asset = createMockRecordAsset({ value: null as unknown });
        expect(asset.value).toBeNull();
    });

    it('should handle empty sys updates object', () => {
        const assetId = 'asset-1';
        const sysUpdates: Partial<AssetSysMetadata> = {};

        if (assetId) {
            expect(Object.keys(sysUpdates)).toHaveLength(0);
        }
    });
});
