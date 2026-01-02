// Port Types Tests
// Tests for port data type compatibility and value creation helpers

import { describe, it, expect } from 'vitest';
import {
    isTypeCompatible,
    textValue,
    jsonValue,
    imageValue,
    PortDataType,
} from '../types';

describe('isTypeCompatible', () => {
    describe('exact match', () => {
        const types: PortDataType[] = ['text', 'json', 'video', 'array', 'any'];

        types.forEach(type => {
            it(`should return true for same type: ${type} -> ${type}`, () => {
                expect(isTypeCompatible(type, type)).toBe(true);
            });
        });
    });

    describe('any target', () => {
        const sources: PortDataType[] = ['text', 'json', 'video', 'array'];

        sources.forEach(source => {
            it(`should accept ${source} when target is 'any'`, () => {
                expect(isTypeCompatible(source, 'any')).toBe(true);
            });
        });
    });

    describe('json to text conversion', () => {
        it('should allow json to connect to text (stringify)', () => {
            expect(isTypeCompatible('json', 'text')).toBe(true);
        });
    });

    describe('incompatible types', () => {
        const incompatiblePairs: [PortDataType, PortDataType][] = [
            ['text', 'json'],
            ['text', 'video'],
            ['video', 'text'],
            ['video', 'json'],
            ['array', 'text'],
        ];

        incompatiblePairs.forEach(([source, target]) => {
            it(`should reject ${source} -> ${target}`, () => {
                expect(isTypeCompatible(source, target)).toBe(false);
            });
        });
    });
});

describe('PortValue helpers', () => {
    describe('textValue', () => {
        it('should create text port value', () => {
            const value = textValue('hello world');

            expect(value.type).toBe('text');
            expect(value.value).toBe('hello world');
            expect(value.meta).toBeUndefined();
        });

        it('should include meta when provided', () => {
            const meta = { nodeId: 'node-1', portId: 'output' };
            const value = textValue('test', meta);

            expect(value.meta).toEqual(meta);
        });
    });

    describe('jsonValue', () => {
        it('should create json port value', () => {
            const data = { foo: 'bar', count: 42 };
            const value = jsonValue(data);

            expect(value.type).toBe('json');
            expect(value.value).toEqual(data);
        });

        it('should include schema when provided', () => {
            const schema = [{ id: '1', key: 'name', label: 'Name', type: 'string' as const }];
            const value = jsonValue({}, schema);

            expect(value.schema).toEqual(schema);
        });

        it('should handle arrays', () => {
            const arr = [1, 2, 3];
            const value = jsonValue(arr);

            expect(value.value).toEqual(arr);
        });
    });

    describe('imageValue', () => {
        it('should create image port value as json with url field', () => {
            const url = 'https://example.com/image.png';
            const value = imageValue(url);

            expect(value.type).toBe('json');  // Now returns json
            expect(value.value).toEqual({ url });  // Value is { url }
        });

        it('should accept data URLs', () => {
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
            const value = imageValue(dataUrl);

            expect(value.value).toEqual({ url: dataUrl });
        });
    });
});
