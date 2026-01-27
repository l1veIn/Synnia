// Prompt Utility Tests
// Tests for value extraction, interpolation, and JSON repair utilities

import { describe, it, expect } from 'vitest';
import {
    extractValue,
    extractText,
    extractNumber,
    interpolate,
    repairTruncatedJsonArray,
} from '../promptUtils';

// ============================================================================
// Tests
// ============================================================================

describe('promptUtils', () => {
    describe('extractValue', () => {
        it('should return primitive values as-is', () => {
            expect(extractValue('hello')).toBe('hello');
            expect(extractValue(42)).toBe(42);
            expect(extractValue(true)).toBe(true);
            expect(extractValue(null)).toBe(null);
            expect(extractValue(undefined)).toBe(undefined);
        });

        it('should extract content from objects with content property', () => {
            expect(extractValue({ content: 'extracted' })).toBe('extracted');
            expect(extractValue({ content: 123 })).toBe(123);
            expect(extractValue({ content: null })).toBe(null);
        });

        it('should extract value from objects with value property', () => {
            expect(extractValue({ value: 'extracted' })).toBe('extracted');
            expect(extractValue({ value: 456 })).toBe(456);
            expect(extractValue({ value: null })).toBe(null);
        });

        it('should prioritize content over value when both exist', () => {
            expect(extractValue({ content: 'fromContent', value: 'fromValue' })).toBe('fromContent');
        });

        it('should return object as-is when it has neither content nor value', () => {
            const obj = { foo: 'bar', baz: 123 };
            expect(extractValue(obj)).toEqual(obj);
        });

        it('should handle empty objects', () => {
            expect(extractValue({})).toEqual({});
        });

        it('should handle objects with null content', () => {
            expect(extractValue({ content: null, other: 'value' })).toBe(null);
        });

        it('should handle objects with undefined content', () => {
            const obj = { content: undefined, other: 'value' };
            expect(extractValue(obj)).toEqual(obj);
        });
    });

    describe('extractText', () => {
        it('should convert string values to string', () => {
            expect(extractText('hello')).toBe('hello');
        });

        it('should convert numbers to string', () => {
            expect(extractText(42)).toBe('42');
            expect(extractText(3.14)).toBe('3.14');
        });

        it('should convert booleans to string', () => {
            expect(extractText(true)).toBe('true');
            expect(extractText(false)).toBe('false');
        });

        it('should convert null to empty string', () => {
            expect(extractText(null)).toBe('');
        });

        it('should convert undefined to empty string', () => {
            expect(extractText(undefined)).toBe('');
        });

        it('should extract content and convert to string', () => {
            expect(extractText({ content: 'extracted' })).toBe('extracted');
            expect(extractText({ content: 123 })).toBe('123');
        });

        it('should extract value and convert to string', () => {
            expect(extractText({ value: 'extracted' })).toBe('extracted');
            expect(extractText({ value: 456 })).toBe('456');
        });

        it('should convert objects to string representation', () => {
            const obj = { foo: 'bar' };
            const result = extractText(obj);
            expect(result).toBe('[object Object]');
        });

        it('should convert arrays to string representation', () => {
            expect(extractText([1, 2, 3])).toBe('1,2,3');
        });

        it('should handle zero values', () => {
            expect(extractText(0)).toBe('0');
        });
    });

    describe('extractNumber', () => {
        it('should convert numeric strings to numbers', () => {
            expect(extractNumber('42')).toBe(42);
            expect(extractNumber('3.14')).toBe(3.14);
        });

        it('should return numbers as-is', () => {
            expect(extractNumber(42)).toBe(42);
            expect(extractNumber(3.14)).toBe(3.14);
        });

        it('should convert null to 0', () => {
            expect(extractNumber(null)).toBe(0);
        });

        it('should convert undefined to 0', () => {
            expect(extractNumber(undefined)).toBe(0);
        });

        it('should extract content and convert to number', () => {
            expect(extractNumber({ content: '123' })).toBe(123);
            expect(extractNumber({ content: 456 })).toBe(456);
        });

        it('should extract value and convert to number', () => {
            expect(extractNumber({ value: '789' })).toBe(789);
            expect(extractNumber({ value: 999 })).toBe(999);
        });

        it('should handle NaN for non-numeric strings', () => {
            expect(extractNumber('not a number')).toBeNaN();
        });

        it('should handle boolean true as 1', () => {
            expect(extractNumber(true)).toBe(1);
        });

        it('should handle boolean false as 0', () => {
            expect(extractNumber(false)).toBe(0);
        });

        it('should handle zero values', () => {
            expect(extractNumber(0)).toBe(0);
            expect(extractNumber('0')).toBe(0);
        });
    });

    describe('interpolate', () => {
        it('should replace single placeholder with value', () => {
            const result = interpolate('Hello {{name}}', { name: 'World' });
            expect(result).toBe('Hello World');
        });

        it('should replace multiple placeholders', () => {
            const result = interpolate('{{greeting}} {{name}}, your {{item}} is ready', {
                greeting: 'Dear',
                name: 'Alice',
                item: 'order',
            });
            expect(result).toBe('Dear Alice, your order is ready');
        });

        it('should replace duplicate placeholders with same value', () => {
            const result = interpolate('{{name}} says hello to {{name}}', { name: 'Bob' });
            expect(result).toBe('Bob says hello to Bob');
        });

        it('should replace placeholders with numeric values', () => {
            const result = interpolate('Count: {{count}}', { count: 42 });
            expect(result).toBe('Count: 42');
        });

        it('should replace placeholders with object content', () => {
            const result = interpolate('Value: {{value}}', { value: { content: 'extracted' } });
            expect(result).toBe('Value: extracted');
        });

        it('should replace placeholders with object value', () => {
            const result = interpolate('Value: {{value}}', { value: { value: 'fromValue' } });
            expect(result).toBe('Value: fromValue');
        });

        it('should return empty string for missing keys', () => {
            const result = interpolate('Hello {{missing}}', {});
            expect(result).toBe('Hello ');
        });

        it('should return empty string for undefined values', () => {
            const result = interpolate('Hello {{name}}', { name: undefined });
            expect(result).toBe('Hello ');
        });

        it('should handle null values', () => {
            const result = interpolate('Value: {{value}}', { value: null });
            expect(result).toBe('Value: ');
        });

        it('should leave text without placeholders unchanged', () => {
            const result = interpolate('Hello World', {});
            expect(result).toBe('Hello World');
        });

        it('should handle empty template', () => {
            const result = interpolate('', { name: 'test' });
            expect(result).toBe('');
        });

        it('should handle placeholder-only template', () => {
            const result = interpolate('{{key}}', { key: 'value' });
            expect(result).toBe('value');
        });

        it('should handle adjacent placeholders', () => {
            const result = interpolate('{{a}}{{b}}{{c}}', { a: '1', b: '2', c: '3' });
            expect(result).toBe('123');
        });

        it('should handle malformed placeholders gracefully', () => {
            // Only {{word}} pattern is matched, not malformed ones
            const result = interpolate('{{key}} and {key} and {{key', { key: 'value' });
            expect(result).toBe('value and {key} and {{key');
        });

        it('should handle zero values', () => {
            const result = interpolate('Count: {{count}}', { count: 0 });
            expect(result).toBe('Count: 0');
        });

        it('should handle boolean values', () => {
            const result = interpolate('Flag: {{flag}}', { flag: true });
            expect(result).toBe('Flag: true');
        });
    });

    describe('repairTruncatedJsonArray', () => {
        it('should return valid JSON arrays as-is', () => {
            const valid = '[{"id":1},{"id":2}]';
            expect(repairTruncatedJsonArray(valid)).toBe(valid);
        });

        it('should return null for non-array input', () => {
            expect(repairTruncatedJsonArray('{"key":"value"}')).toBeNull();
            expect(repairTruncatedJsonArray('string')).toBeNull();
            expect(repairTruncatedJsonArray('')).toBeNull();
        });

        it('should return null for input not starting with [ after trim', () => {
            // Note: trim() is applied first, so leading whitespace is removed
            expect(repairTruncatedJsonArray('x[{"id":1}]')).toBeNull();
            expect(repairTruncatedJsonArray('xxx[{"id":1}')).toBeNull();
        });

        it('should handle input with leading whitespace (trimmed by function)', () => {
            // Function uses .trim() so leading whitespace is removed
            const result = repairTruncatedJsonArray(' [{"id":1}');
            expect(result).toBe('[{"id":1}]');
        });

        it('should repair truncated array with missing closing bracket', () => {
            const truncated = '[{"id":1,"name":"test"}';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1,"name":"test"}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should repair truncated array with partial object at end', () => {
            // The function finds the last complete object (last `}`), so it only keeps
            // up to the first complete object when the second is incomplete
            const truncated = '[{"id":1},{"id":2,"name":"incomplete';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should remove trailing comma before closing array', () => {
            const truncated = '[{"id":1},';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should remove trailing comma with whitespace', () => {
            const truncated = '[{"id":1},  ';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should handle array with multiple complete objects', () => {
            const truncated = '[{"id":1},{"id":2},{"id":3}';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1},{"id":2},{"id":3}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should handle trailing comma after last complete object', () => {
            const truncated = '[{"id":1},{"id":2},';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1},{"id":2}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should return null for array with no complete objects', () => {
            const truncated = '[{';
            expect(repairTruncatedJsonArray(truncated)).toBeNull();
        });

        it('should return null for empty array start only', () => {
            const truncated = '[';
            expect(repairTruncatedJsonArray(truncated)).toBeNull();
        });

        it('should handle whitespace in input', () => {
            const truncated = '  [{"id":1},  ';
            const repaired = repairTruncatedJsonArray(truncated);
            // Trims leading whitespace but preserves internal structure
            expect(repaired).toBe('[{"id":1}]');
        });

        it('should handle nested objects', () => {
            const truncated = '[{"user":{"name":"test","email":"test@example.com"}}';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"user":{"name":"test","email":"test@example.com"}}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should repair to last complete object even if later object is incomplete', () => {
            // The function finds the last complete object (last `}`), so it salvages
            // what it can even if later objects are incomplete
            const truncated = '[{"id":1}, {"unclosed": {';
            const repaired = repairTruncatedJsonArray(truncated);
            // Keeps only the first complete object
            expect(repaired).toBe('[{"id":1}]');
        });

        it('should handle empty string', () => {
            expect(repairTruncatedJsonArray('')).toBeNull();
        });

        it('should handle array with trailing comma and whitespace', () => {
            const truncated = '[{"id":1} , \t ';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"id":1}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });

        it('should preserve the last complete object with nested structures', () => {
            const truncated = '[{"outer":{"inner":"value"}}, {"another":"complete"}';
            const repaired = repairTruncatedJsonArray(truncated);
            expect(repaired).toBe('[{"outer":{"inner":"value"}}, {"another":"complete"}]');
            // Verify it's valid JSON
            expect(() => JSON.parse(repaired!)).not.toThrow();
        });
    });
});
