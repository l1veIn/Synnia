// @ts-nocheck
// Schema Compatibility Tests
// Tests for comparing schema snapshots with current recipe schema

import { describe, it, expect } from "vitest";
import {
  checkSchemaCompatibility,
  type SchemaCompatResult,
  type SchemaField,
} from "../schemaCompat";

// ============================================================================
// Test Data
// ============================================================================

const mockSnapshot: SchemaField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
];

const mockCurrentSchema: SchemaField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
];

const extendedCurrentSchema: SchemaField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

const reducedCurrentSchema: SchemaField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
];

const completelyDifferentSchema: SchemaField[] = [
  { key: "foo", label: "Foo" },
  { key: "bar", label: "Bar" },
];

// ============================================================================
// Tests
// ============================================================================

describe("schemaCompat", () => {
  describe("checkSchemaCompatibility", () => {
    describe("when snapshot is undefined or empty", () => {
      it("should return compatible result when snapshot is undefined", () => {
        const result = checkSchemaCompatibility(undefined, mockCurrentSchema);

        expect(result).toEqual({
          compatible: true,
          warnings: [],
          added: [],
          removed: [],
        } satisfies SchemaCompatResult);
      });

      it("should return compatible result when snapshot is empty array", () => {
        const result = checkSchemaCompatibility([], mockCurrentSchema);

        expect(result).toEqual({
          compatible: true,
          warnings: [],
          added: [],
          removed: [],
        } satisfies SchemaCompatResult);
      });

      it("should treat empty snapshot as first run with no warnings", () => {
        const result = checkSchemaCompatibility([], mockCurrentSchema);

        expect(result.compatible).toBe(true);
        expect(result.warnings).toHaveLength(0);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
      });
    });

    describe("when schemas are identical", () => {
      it("should return compatible with no warnings or changes", () => {
        const result = checkSchemaCompatibility(
          mockSnapshot,
          mockCurrentSchema,
        );

        expect(result.compatible).toBe(true);
        expect(result.warnings).toHaveLength(0);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
      });

      it("should handle schemas with same fields but different labels", () => {
        const currentWithDifferentLabels: SchemaField[] = [
          { key: "id", label: "Identifier" },
          { key: "name", label: "Full Name" },
          { key: "email", label: "Email Address" },
        ];

        const result = checkSchemaCompatibility(
          mockSnapshot,
          currentWithDifferentLabels,
        );

        expect(result.compatible).toBe(true);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
      });
    });

    describe("when fields are added to current schema", () => {
      it("should return compatible with added fields listed", () => {
        const result = checkSchemaCompatibility(
          mockSnapshot,
          extendedCurrentSchema,
        );

        expect(result.compatible).toBe(true);
        expect(result.added).toEqual(["phone"]);
        expect(result.removed).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it("should detect multiple added fields", () => {
        const currentWithManyAdditions: SchemaField[] = [
          ...mockCurrentSchema,
          { key: "phone", label: "Phone" },
          { key: "address", label: "Address" },
          { key: "city", label: "City" },
        ];

        const result = checkSchemaCompatibility(
          mockSnapshot,
          currentWithManyAdditions,
        );

        expect(result.compatible).toBe(true);
        expect(result.added).toEqual(["phone", "address", "city"]);
        expect(result.added).toHaveLength(3);
      });

      it("should handle empty snapshot as first run (no additions tracked)", () => {
        const result = checkSchemaCompatibility([], completelyDifferentSchema);

        expect(result.compatible).toBe(true);
        expect(result.added).toEqual([]);
        // Empty snapshot is treated as first run - no comparison
      });
    });

    describe("when fields are removed from current schema", () => {
      it("should return incompatible with removed fields listed", () => {
        const result = checkSchemaCompatibility(
          mockSnapshot,
          reducedCurrentSchema,
        );

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["email"]);
        expect(result.added).toHaveLength(0);
      });

      it("should generate warning messages for removed fields with labels", () => {
        const result = checkSchemaCompatibility(
          mockSnapshot,
          reducedCurrentSchema,
        );

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toBe(
          'Field "Email" was removed from recipe',
        );
      });

      it("should generate warning messages for removed fields without labels", () => {
        const snapshotWithoutLabels: SchemaField[] = [
          { key: "id" },
          { key: "name" },
          { key: "email" },
        ];

        const result = checkSchemaCompatibility(
          snapshotWithoutLabels,
          reducedCurrentSchema,
        );

        expect(result.warnings[0]).toBe(
          'Field "email" was removed from recipe',
        );
      });

      it("should detect multiple removed fields", () => {
        const minimalCurrentSchema: SchemaField[] = [
          { key: "id", label: "ID" },
        ];

        const result = checkSchemaCompatibility(
          mockSnapshot,
          minimalCurrentSchema,
        );

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["name", "email"]);
        expect(result.removed).toHaveLength(2);
        expect(result.warnings).toHaveLength(2);
      });
    });

    describe("when fields are both added and removed", () => {
      it("should report both added and removed fields", () => {
        const currentWithChanges: SchemaField[] = [
          { key: "id", label: "ID" },
          { key: "username", label: "Username" },
          { key: "phone", label: "Phone" },
        ];

        const result = checkSchemaCompatibility(
          mockSnapshot,
          currentWithChanges,
        );

        expect(result.compatible).toBe(false); // incompatible due to removals
        expect(result.added).toEqual(["username", "phone"]);
        expect(result.removed).toEqual(["name", "email"]);
      });

      it("should generate warnings for each removed field", () => {
        const currentWithChanges: SchemaField[] = [
          { key: "id", label: "ID" },
          { key: "username", label: "Username" },
        ];

        const result = checkSchemaCompatibility(
          mockSnapshot,
          currentWithChanges,
        );

        expect(result.warnings).toHaveLength(2);
        expect(result.warnings).toContain(
          'Field "Name" was removed from recipe',
        );
        expect(result.warnings).toContain(
          'Field "Email" was removed from recipe',
        );
      });
    });

    describe("edge cases", () => {
      it("should handle empty current schema with populated snapshot", () => {
        const result = checkSchemaCompatibility(mockSnapshot, []);

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["id", "name", "email"]);
        expect(result.warnings).toHaveLength(3);
      });

      it("should handle both schemas being empty", () => {
        const result = checkSchemaCompatibility([], []);

        expect(result.compatible).toBe(true);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
      });

      it("should handle single field snapshot removal", () => {
        const singleFieldSnapshot: SchemaField[] = [
          { key: "onlyField", label: "Only" },
        ];
        const result = checkSchemaCompatibility(singleFieldSnapshot, []);

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["onlyField"]);
        expect(result.warnings).toEqual([
          'Field "Only" was removed from recipe',
        ]);
      });

      it("should handle single field with empty snapshot as first run", () => {
        const result = checkSchemaCompatibility(
          [],
          [{ key: "newField", label: "New" }],
        );

        expect(result.compatible).toBe(true);
        expect(result.added).toEqual([]);
        // Empty snapshot is treated as first run - no comparison
      });

      it("should handle fields with special characters in keys", () => {
        const snapshotWithSpecialChars: SchemaField[] = [
          { key: "user-id", label: "User ID" },
          { key: "first_name", label: "First Name" },
        ];
        const currentWithSpecialChars: SchemaField[] = [
          { key: "user-id", label: "User ID" },
          { key: "last_name", label: "Last Name" },
        ];

        const result = checkSchemaCompatibility(
          snapshotWithSpecialChars,
          currentWithSpecialChars,
        );

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["first_name"]);
        expect(result.added).toEqual(["last_name"]);
      });

      it("should be case-sensitive for field keys", () => {
        const snapshot: SchemaField[] = [
          { key: "ID", label: "ID" },
          { key: "name", label: "Name" },
        ];
        const current: SchemaField[] = [
          { key: "id", label: "ID" }, // lowercase
          { key: "name", label: "Name" },
        ];

        const result = checkSchemaCompatibility(snapshot, current);

        expect(result.compatible).toBe(false);
        expect(result.removed).toEqual(["ID"]);
        expect(result.added).toEqual(["id"]);
      });
    });

    describe("compatibility determination", () => {
      it("should only consider removed fields for compatibility", () => {
        // Added fields don't affect compatibility
        const result = checkSchemaCompatibility(
          [{ key: "id", label: "ID" }],
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
          ],
        );

        expect(result.compatible).toBe(true);
        expect(result.added).toHaveLength(2);
      });

      it("should be incompatible when any field is removed", () => {
        const result = checkSchemaCompatibility(
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
          ],
          [{ key: "id", label: "ID" }],
        );

        expect(result.compatible).toBe(false);
      });

      it("should be compatible when no fields are removed", () => {
        const result = checkSchemaCompatibility(
          [{ key: "id", label: "ID" }],
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
          ],
        );

        expect(result.compatible).toBe(true);
      });
    });
  });
});
