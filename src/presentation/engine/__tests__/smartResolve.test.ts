/**
 * Smart Resolve Tests
 * Tests for unified data resolution logic - "能提取 = 能连接"
 */

import { describe, it, expect } from "vitest";
import {
  isRequiredSatisfied,
  isTypeMatch,
  smartResolve,
  smartResolveValue,
  smartResolveError,
} from "../smartResolve";
import type { FieldDefinition, FieldType } from "@/domain/asset/types";

// ============================================================================
// Test Data Helpers
// ============================================================================

const createField = (
  overrides: Partial<FieldDefinition> = {},
): FieldDefinition => ({
  key: "testField",
  type: "string",
  ...overrides,
});

// ============================================================================
// isRequiredSatisfied Tests
// ============================================================================

describe("isRequiredSatisfied", () => {
  describe("non-required fields", () => {
    it("should return true for non-required field with undefined value", () => {
      const field = createField({ required: false });
      expect(isRequiredSatisfied(undefined, field)).toBe(true);
    });

    it("should return true for non-required field with null value", () => {
      const field = createField({ required: false });
      expect(isRequiredSatisfied(null, field)).toBe(true);
    });

    it("should return true for non-required field with any value", () => {
      const field = createField({ required: false, type: "string" });
      expect(isRequiredSatisfied("", field)).toBe(true);
    });
  });

  describe("required string fields", () => {
    const field = createField({ type: "string", required: true });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isRequiredSatisfied("", field)).toBe(false);
    });

    it("should return false for whitespace-only string", () => {
      expect(isRequiredSatisfied("   ", field)).toBe(false);
    });

    it("should return true for non-empty string", () => {
      expect(isRequiredSatisfied("hello", field)).toBe(true);
    });

    it("should return true for string with only whitespace and content", () => {
      expect(isRequiredSatisfied("  hello  ", field)).toBe(true);
    });
  });

  describe("required number fields", () => {
    const field = createField({ type: "number", required: true });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false for NaN", () => {
      expect(isRequiredSatisfied(NaN, field)).toBe(false);
    });

    it("should return true for zero", () => {
      expect(isRequiredSatisfied(0, field)).toBe(true);
    });

    it("should return true for negative number", () => {
      expect(isRequiredSatisfied(-42, field)).toBe(true);
    });

    it("should return true for positive number", () => {
      expect(isRequiredSatisfied(42, field)).toBe(true);
    });

    it("should return true for decimal number", () => {
      expect(isRequiredSatisfied(3.14, field)).toBe(true);
    });
  });

  describe("required boolean fields", () => {
    const field = createField({ type: "boolean", required: true });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return true for false", () => {
      expect(isRequiredSatisfied(false, field)).toBe(true);
    });

    it("should return true for true", () => {
      expect(isRequiredSatisfied(true, field)).toBe(true);
    });
  });

  describe("required array fields", () => {
    const field = createField({ type: "array", required: true });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false for empty array", () => {
      expect(isRequiredSatisfied([], field)).toBe(false);
    });

    it("should return true for array with one element", () => {
      expect(isRequiredSatisfied([1], field)).toBe(true);
    });

    it("should return true for array with multiple elements", () => {
      expect(isRequiredSatisfied([1, 2, 3], field)).toBe(true);
    });
  });

  describe("required object fields without schema", () => {
    const field = createField({ type: "object", required: true });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false for array (arrays are not objects)", () => {
      expect(isRequiredSatisfied([], field)).toBe(false);
    });

    it("should return true for empty object", () => {
      expect(isRequiredSatisfied({}, field)).toBe(true);
    });

    it("should return true for non-empty object", () => {
      expect(isRequiredSatisfied({ a: 1 }, field)).toBe(true);
    });
  });

  describe("required object fields with nested schema", () => {
    const field = createField({
      type: "object",
      required: true,
      schema: [
        { key: "name", type: "string", required: true },
        { key: "age", type: "number", required: false },
        { key: "email", type: "string", required: true },
      ],
    });

    it("should return false for undefined", () => {
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false when required sub-field is missing", () => {
      expect(isRequiredSatisfied({ age: 25 }, field)).toBe(false);
    });

    it("should return false when required sub-field is null", () => {
      expect(
        isRequiredSatisfied({ name: null, email: "test@test.com" }, field),
      ).toBe(false);
    });

    it("should return false when required sub-field is undefined", () => {
      expect(
        isRequiredSatisfied({ name: "John", email: undefined }, field),
      ).toBe(false);
    });

    it("should return true when all required sub-fields are satisfied", () => {
      expect(
        isRequiredSatisfied({ name: "John", email: "test@test.com" }, field),
      ).toBe(true);
    });

    it("should return true when all required and optional sub-fields are present", () => {
      expect(
        isRequiredSatisfied(
          { name: "John", age: 25, email: "test@test.com" },
          field,
        ),
      ).toBe(true);
    });

    it("should return false for empty string in required string sub-field", () => {
      expect(
        isRequiredSatisfied({ name: "", email: "test@test.com" }, field),
      ).toBe(false);
    });

    it("should handle nested object validation recursively", () => {
      const nestedField = createField({
        type: "object",
        required: true,
        schema: [
          {
            key: "address",
            type: "object",
            required: true,
            schema: [
              { key: "street", type: "string", required: true },
              { key: "city", type: "string", required: true },
            ],
          },
        ],
      });

      expect(
        isRequiredSatisfied(
          { address: { street: "123 Main", city: "NYC" } },
          nestedField,
        ),
      ).toBe(true);
      expect(
        isRequiredSatisfied({ address: { street: "123 Main" } }, nestedField),
      ).toBe(false);
    });
  });

  describe("unknown field types", () => {
    it("should return true for unknown type with value", () => {
      const field = createField({
        type: "unknown" as FieldType,
        required: true,
      });
      expect(isRequiredSatisfied("some value", field)).toBe(true);
    });

    it("should return false for unknown type with null", () => {
      const field = createField({
        type: "unknown" as FieldType,
        required: true,
      });
      expect(isRequiredSatisfied(null, field)).toBe(false);
    });

    it("should return false for unknown type with undefined", () => {
      const field = createField({
        type: "unknown" as FieldType,
        required: true,
      });
      expect(isRequiredSatisfied(undefined, field)).toBe(false);
    });
  });
});

// ============================================================================
// isTypeMatch Tests
// ============================================================================

describe("isTypeMatch", () => {
  describe("string type matching", () => {
    it("should return true for string value", () => {
      expect(isTypeMatch("hello", "string")).toBe(true);
    });

    it("should return false for number", () => {
      expect(isTypeMatch(42, "string")).toBe(false);
    });

    it("should return false for boolean", () => {
      expect(isTypeMatch(true, "string")).toBe(false);
    });

    it("should return false for object", () => {
      expect(isTypeMatch({}, "string")).toBe(false);
    });

    it("should return false for array", () => {
      expect(isTypeMatch([], "string")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTypeMatch(null, "string")).toBe(false);
    });
  });

  describe("number type matching", () => {
    it("should return true for number value", () => {
      expect(isTypeMatch(42, "number")).toBe(true);
    });

    it("should return true for NaN (considered number type)", () => {
      expect(isTypeMatch(NaN, "number")).toBe(true);
    });

    it("should return false for string", () => {
      expect(isTypeMatch("42", "number")).toBe(false);
    });

    it("should return false for boolean", () => {
      expect(isTypeMatch(true, "number")).toBe(false);
    });
  });

  describe("boolean type matching", () => {
    it("should return true for true", () => {
      expect(isTypeMatch(true, "boolean")).toBe(true);
    });

    it("should return true for false", () => {
      expect(isTypeMatch(false, "boolean")).toBe(true);
    });

    it('should return false for string "true"', () => {
      expect(isTypeMatch("true", "boolean")).toBe(false);
    });

    it("should return false for number 1", () => {
      expect(isTypeMatch(1, "boolean")).toBe(false);
    });
  });

  describe("array type matching", () => {
    it("should return true for empty array", () => {
      expect(isTypeMatch([], "array")).toBe(true);
    });

    it("should return true for non-empty array", () => {
      expect(isTypeMatch([1, 2, 3], "array")).toBe(true);
    });

    it("should return false for object", () => {
      expect(isTypeMatch({}, "array")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTypeMatch(null, "array")).toBe(false);
    });
  });

  describe("object type matching", () => {
    it("should return true for empty object", () => {
      expect(isTypeMatch({}, "object")).toBe(true);
    });

    it("should return true for non-empty object", () => {
      expect(isTypeMatch({ a: 1 }, "object")).toBe(true);
    });

    it("should return false for array", () => {
      expect(isTypeMatch([], "object")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTypeMatch(null, "object")).toBe(false);
    });

    it("should return false for string", () => {
      expect(isTypeMatch("string", "object")).toBe(false);
    });
  });

  describe("unknown type matching", () => {
    it("should return true for any value when type is unknown", () => {
      expect(isTypeMatch("anything", "unknown")).toBe(true);
      expect(isTypeMatch(42, "unknown")).toBe(true);
      expect(isTypeMatch(null, "unknown")).toBe(true);
      expect(isTypeMatch(undefined, "unknown")).toBe(true);
    });
  });
});

// ============================================================================
// smartResolve Tests
// ============================================================================

describe("smartResolve", () => {
  describe("non-object sources (direct value resolution)", () => {
    it("should return success for matching string type and satisfied requirement", () => {
      const field = createField({ type: "string", required: true });
      const result = smartResolve("hello", field);

      expect(result).toEqual({
        success: true,
        value: "hello",
        strategy: "keyed",
      });
    });

    it("should return success for matching number type and satisfied requirement", () => {
      const field = createField({ type: "number", required: true });
      const result = smartResolve(42, field);

      expect(result).toEqual({
        success: true,
        value: 42,
        strategy: "keyed",
      });
    });

    it("should return success for matching boolean type", () => {
      const field = createField({ type: "boolean", required: true });
      const result = smartResolve(true, field);

      expect(result).toEqual({
        success: true,
        value: true,
        strategy: "keyed",
      });
    });

    it("should return success for matching array type with elements", () => {
      const field = createField({ type: "array", required: true });
      const result = smartResolve([1, 2, 3], field);

      expect(result).toEqual({
        success: true,
        value: [1, 2, 3],
        strategy: "structural",
      });
    });

    it("should return failure for non-matching type", () => {
      const field = createField({ type: "string", required: true });
      const result = smartResolve(42, field);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.strategy).toBe("none");
      expect(result.error).toContain("not an object");
    });

    it("should return failure for unsatisfied requirement", () => {
      const field = createField({ type: "string", required: true });
      const result = smartResolve("", field);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.strategy).toBe("none");
    });

    it("should handle null source with error", () => {
      const field = createField({ type: "string", required: true });
      const result = smartResolve(null, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
      expect(result.error).toContain("not an object");
    });
  });

  describe("keyed extraction strategy", () => {
    const field = createField({
      key: "username",
      type: "string",
      required: true,
    });

    it("should extract value when key exists in source object", () => {
      const source = { username: "john_doe", other: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.value).toBe("john_doe");
      expect(result.strategy).toBe("keyed");
    });

    it("should fail when keyed value has wrong type", () => {
      const source = { username: 123 };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });

    it("should fail when keyed value does not satisfy required", () => {
      const source = { username: "" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });

    it("should fall through to structural when key exists but invalid", () => {
      const objectField = createField({
        key: "data",
        type: "object",
        required: true,
        schema: [{ key: "requiredField", type: "string", required: true }],
      });
      const source = { data: "not an object" };
      const result = smartResolve(source, objectField);

      // Key exists but wrong type, should try structural match
      // Structural fails because required sub-field is missing
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });
  });

  describe("structural match strategy (object type)", () => {
    const objectField = createField({
      key: "user",
      type: "object",
      required: true,
      schema: [
        { key: "name", type: "string", required: true },
        { key: "age", type: "number", required: false },
      ],
    });

    it("should use entire source object when type is object and valid", () => {
      const source = { name: "John", age: 25 };
      const result = smartResolve(source, objectField);

      expect(result.success).toBe(true);
      expect(result.value).toBe(source);
      expect(result.strategy).toBe("structural");
    });

    it("should succeed with empty object when no required sub-fields", () => {
      const field = createField({
        key: "data",
        type: "object",
        required: true,
        schema: [{ key: "optional", type: "string", required: false }],
      });
      const source = { extra: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("structural");
    });

    it("should fail when required sub-fields are missing", () => {
      const source = { age: 25 }; // missing 'name'
      const result = smartResolve(source, objectField);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.strategy).toBe("none");
      expect(result.error).toContain("Missing required fields");
      expect(result.error).toContain("name");
    });

    it("should include all missing required fields in error message", () => {
      const field = createField({
        key: "user",
        type: "object",
        required: true,
        schema: [
          { key: "name", type: "string", required: true, label: "Full Name" },
          {
            key: "email",
            type: "string",
            required: true,
            label: "Email Address",
          },
          { key: "age", type: "number", required: true },
        ],
      });
      const source = {};
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Full Name");
      expect(result.error).toContain("Email Address");
      expect(result.error).toContain("age");
    });

    it("should use label in error message when available", () => {
      const field = createField({
        key: "user",
        type: "object",
        required: true,
        schema: [
          { key: "name", type: "string", required: true, label: "User Name" },
        ],
      });
      const source = {};
      const result = smartResolve(source, field);

      expect(result.error).toContain("User Name");
    });

    it("should use key in error message when label is not available", () => {
      const field = createField({
        key: "user",
        type: "object",
        required: true,
        schema: [{ key: "name", type: "string", required: true }],
      });
      const source = {};
      const result = smartResolve(source, field);

      expect(result.error).toContain("name");
    });

    it("should fail when required sub-field fails nested validation", () => {
      const source = { name: "", age: 25 }; // name is empty string
      const result = smartResolve(source, objectField);

      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });
  });

  describe("rejection strategy (none)", () => {
    it("should return failure when no strategy matches for string type", () => {
      const field = createField({
        key: "missing",
        type: "string",
        required: true,
      });
      const source = { other: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.strategy).toBe("none");
      expect(result.error).toContain("missing");
      expect(result.error).toContain("string");
    });

    it("should return failure when no strategy matches for number type", () => {
      const field = createField({
        key: "count",
        type: "number",
        required: false,
      });
      const source = { other: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.strategy).toBe("none");
      expect(result.error).toContain("count");
    });

    it("should return failure when no strategy matches for boolean type", () => {
      const field = createField({
        key: "enabled",
        type: "boolean",
        required: false,
      });
      const source = { other: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });

    it("should return failure when no strategy matches for array type", () => {
      const field = createField({
        key: "items",
        type: "array",
        required: false,
      });
      const source = { other: "value" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });
  });

  describe("array sources", () => {
    it("should match array source directly when target expects array", () => {
      const field = createField({
        key: "items",
        type: "array",
        required: true,
      });
      const source = [1, 2, 3];
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.value).toBe(source);
      expect(result.strategy).toBe("structural");
    });

    // ───────────────────────────────────────────────────────────────────
    // Array → Single Fallback Tests
    // ───────────────────────────────────────────────────────────────────

    it("should extract field from first array item when target expects string", () => {
      // User scenario: [{name: "金满囤", ...}] → target expects string field "name"
      const field = createField({
        key: "name",
        type: "string",
        required: true,
      });
      const source = [
        { id: "opt-3", name: "金满囤", rationale: "test" },
        { id: "opt-4", name: "其他名", rationale: "test2" }
      ];
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.value).toBe("金满囤");
      expect(result.strategy).toBe("keyed");
    });

    it("should extract first item as object when target expects object", () => {
      const field = createField({
        key: "item",
        type: "object",
        required: true,
      });
      const source = [
        { id: "opt-1", name: "item1" },
        { id: "opt-2", name: "item2" }
      ];
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ id: "opt-1", name: "item1" });
      expect(result.strategy).toBe("structural");
    });

    it("should fail when first array item lacks required field", () => {
      const field = createField({
        key: "missingField",
        type: "string",
        required: true,
      });
      const source = [{ name: "test" }];
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
    });

    // ───────────────────────────────────────────────────────────────────
    // Single → Array Fallback Tests (via keyed extraction)
    // ───────────────────────────────────────────────────────────────────

    it("should wrap object in array when keyed extraction gets object but target expects array", () => {
      const field = createField({
        key: "items",
        type: "array",
        required: true,
      });
      const source = {
        items: { id: "single-item", name: "test" }
      };
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.value).toEqual([{ id: "single-item", name: "test" }]);
      expect(result.strategy).toBe("keyed");
    });
  });

  describe("edge cases", () => {
    it("should handle source with same key but wrong type", () => {
      const field = createField({
        key: "count",
        type: "number",
        required: true,
      });
      const source = { count: "not a number" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe("none");
    });

    it("should handle non-required field with missing key", () => {
      const field = createField({
        key: "optional",
        type: "string",
        required: false,
      });
      const source = { other: "value" };
      const result = smartResolve(source, field);

      // Non-required string field can't be resolved from source without key
      expect(result.success).toBe(false);
    });

    it("should handle object type with no schema", () => {
      const field = createField({
        key: "data",
        type: "object",
        required: true,
      });
      const source = { anything: "goes" };
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("structural");
    });

    it("should handle complex nested object resolution", () => {
      const field = createField({
        key: "config",
        type: "object",
        required: true,
        schema: [
          {
            key: "database",
            type: "object",
            required: true,
            schema: [
              { key: "host", type: "string", required: true },
              { key: "port", type: "number", required: true },
            ],
          },
        ],
      });
      const source = {
        database: { host: "localhost", port: 5432 },
      };
      const result = smartResolve(source, field);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("structural");
    });

    it("should prefer keyed extraction over structural when both possible", () => {
      const field = createField({
        key: "user",
        type: "object",
        required: true,
        schema: [{ key: "name", type: "string", required: true }],
      });
      const source = {
        user: { name: "John" },
        name: "Direct Name",
      };
      const result = smartResolve(source, field);

      // Should use keyed extraction, not structural
      expect(result.success).toBe(true);
      expect(result.strategy).toBe("keyed");
      expect(result.value).toEqual({ name: "John" });
    });
  });
});

// ============================================================================
// smartResolveValue Tests
// ============================================================================

describe("smartResolveValue", () => {
  it("should return value when resolution succeeds", () => {
    const field = createField({ key: "name", type: "string", required: true });
    const source = { name: "John" };

    const result = smartResolveValue(source, field);

    expect(result).toBe("John");
  });

  it("should return null when resolution fails", () => {
    const field = createField({
      key: "missing",
      type: "string",
      required: true,
    });
    const source = { other: "value" };

    const result = smartResolveValue(source, field);

    expect(result).toBeNull();
  });

  it("should return null for non-object source with wrong type", () => {
    const field = createField({ key: "count", type: "number", required: true });

    const result = smartResolveValue("not a number", field);

    expect(result).toBeNull();
  });

  it("should return extracted value for direct match", () => {
    const field = createField({
      key: "status",
      type: "boolean",
      required: false,
    });
    const source = true;

    const result = smartResolveValue(source, field);

    expect(result).toBe(true);
  });

  it("should return null for unsatisfied required array", () => {
    const field = createField({ key: "items", type: "array", required: true });

    const result = smartResolveValue([], field);

    expect(result).toBeNull();
  });
});

// ============================================================================
// smartResolveError Tests
// ============================================================================

describe("smartResolveError", () => {
  it("should return null when resolution succeeds", () => {
    const field = createField({ key: "name", type: "string", required: true });
    const source = { name: "John" };

    const result = smartResolveError(source, field);

    expect(result).toBeNull();
  });

  it("should return error message when resolution fails", () => {
    const field = createField({
      key: "missing",
      type: "string",
      required: true,
    });
    const source = { other: "value" };

    const result = smartResolveError(source, field);

    expect(result).toContain("missing");
    expect(result).toContain("string");
  });

  it("should return specific error message from failed resolution", () => {
    const field = createField({
      key: "missing",
      type: "string",
      required: true,
    });
    const source = { other: "value" };

    const fullResult = smartResolve(source, field);
    const errorResult = smartResolveError(source, field);

    expect(errorResult).toContain(fullResult.error || "");
  });

  it("should return specific error message for non-object source", () => {
    const field = createField({ key: "count", type: "number", required: true });

    const result = smartResolveError("invalid", field);

    expect(result).toContain("not an object");
    expect(result).toContain("count");
  });

  it("should return error for missing required object sub-fields", () => {
    const field = createField({
      key: "user",
      type: "object",
      required: true,
      schema: [
        { key: "name", type: "string", required: true, label: "Full Name" },
      ],
    });
    const source = {};

    const result = smartResolveError(source, field);

    expect(result).toContain("Missing required fields");
    expect(result).toContain("Full Name");
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("smartResolve integration scenarios", () => {
  describe("real-world form data extraction", () => {
    it("should resolve user profile data from form output", () => {
      const formOutput = {
        username: "johndoe",
        email: "john@example.com",
        age: 30,
        preferences: { theme: "dark" },
      };

      const usernameField = createField({
        key: "username",
        type: "string",
        required: true,
      });
      const emailField = createField({
        key: "email",
        type: "string",
        required: true,
      });
      const ageField = createField({
        key: "age",
        type: "number",
        required: false,
      });
      const prefsField = createField({
        key: "preferences",
        type: "object",
        required: false,
      });

      expect(smartResolveValue(formOutput, usernameField)).toBe("johndoe");
      expect(smartResolveValue(formOutput, emailField)).toBe(
        "john@example.com",
      );
      expect(smartResolveValue(formOutput, ageField)).toBe(30);
      expect(smartResolveValue(formOutput, prefsField)).toEqual({
        theme: "dark",
      });
    });

    it("should validate required fields in complex form", () => {
      const userField = createField({
        key: "user",
        type: "object",
        required: true,
        schema: [
          { key: "firstName", type: "string", required: true },
          { key: "lastName", type: "string", required: true },
          { key: "email", type: "string", required: true },
          { key: "phone", type: "string", required: false },
        ],
      });

      const validUser = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const invalidUser = {
        firstName: "John",
        // missing lastName and email
      };

      expect(smartResolveError(validUser, userField)).toBeNull();
      expect(smartResolveError(invalidUser, userField)).toContain(
        "Missing required fields",
      );
    });
  });

  describe("API response handling", () => {
    it("should handle array response from API", () => {
      const apiResponse = [1, 2, 3, 4, 5];
      const itemsField = createField({
        key: "items",
        type: "array",
        required: true,
      });

      const result = smartResolveValue(apiResponse, itemsField);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle paginated response structure", () => {
      const paginatedResponse = {
        data: [{ id: 1 }, { id: 2 }],
        page: 1,
        total: 10,
      };

      const dataField = createField({
        key: "data",
        type: "array",
        required: true,
      });

      const result = smartResolveValue(paginatedResponse, dataField);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe("partial data scenarios", () => {
    it("should gracefully handle partial object data", () => {
      const addressField = createField({
        key: "address",
        type: "object",
        required: true, // Changed to true to validate required sub-fields
        schema: [
          { key: "street", type: "string", required: true },
          { key: "city", type: "string", required: true },
          { key: "zipCode", type: "string", required: false },
        ],
      });

      const partialAddress = {
        street: "123 Main St",
        // missing city
        zipCode: "12345",
      };

      const result = smartResolve(partialAddress, addressField);

      expect(result.success).toBe(false);
      expect(result.error).toContain("city");
    });

    it("should handle optional fields correctly", () => {
      const configField = createField({
        key: "config",
        type: "object",
        required: false,
        schema: [
          { key: "timeout", type: "number", required: false },
          { key: "retries", type: "number", required: false },
        ],
      });

      const emptyConfig = {};
      const result = smartResolve(emptyConfig, configField);

      // Should succeed because all fields are optional
      expect(result.success).toBe(true);
    });
  });
});
