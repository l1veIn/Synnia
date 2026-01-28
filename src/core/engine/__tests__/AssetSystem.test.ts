// @ts-nocheck
/**
 * AssetSystem Tests
 * Tests for unified asset management system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AssetSystem } from "../AssetSystem";
import { GraphEngine } from "../GraphEngine";
import { Asset, ValueType, AssetSysMetadata } from "@/types/assets";
import { useWorkflowStore } from "@/store/workflowStore";
import { apiClient } from "@/lib/apiClient";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("../GraphEngine", () => ({
  GraphEngine: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    cleanupOrphanAssets: vi.fn(),
  },
}));

// Get the mock invoke - this will be initialized in beforeEach
let mockInvoke: ReturnType<typeof vi.fn>;

// ============================================================================
// Test Data
// ============================================================================

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: "asset-1",
  valueType: "record",
  value: { name: "Test", count: 42 },
  config: { schema: [] },
  sys: {
    name: "Test Asset",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "user",
    isLibraryAsset: null,
  },
  ...overrides,
});

const createMockSys = (
  overrides: Partial<AssetSysMetadata> = {},
): AssetSysMetadata => ({
  name: "Test Asset",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  source: "user",
  isLibraryAsset: null,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("AssetSystem", () => {
  let assetSystem: AssetSystem;
  let mockEngine: GraphEngine;

  beforeEach(async () => {
    // Import the mocked module to get the invoke spy
    const { invoke } = await import("@tauri-apps/api");
    mockInvoke = vi.mocked(invoke);

    vi.clearAllMocks();

    // Reset store state
    useWorkflowStore.setState({
      assets: {},
      nodes: [],
      edges: [],
      projectMeta: null,
      projectRoot: null,
      serverPort: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      highlightedGroupId: null,
      dockPreviewId: null,
      contextMenuTarget: null,
      inspectorPosition: null,
      isHistoryPaused: false,
      loadProject: vi.fn(),
      restoreDraft: vi.fn(),
      setProjectRoot: vi.fn(),
      setServerPort: vi.fn(),
      setViewport: vi.fn(),
      setContextMenuTarget: vi.fn(),
      setInspectorPosition: vi.fn(),
      setHighlightedGroupId: vi.fn(),
      pauseHistory: vi.fn(),
      resumeHistory: vi.fn(),
      triggerCommit: vi.fn(),
    });

    // Create mock engine
    mockEngine = {
      assets: assetSystem,
    } as unknown as GraphEngine;

    assetSystem = new AssetSystem(mockEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided engine", () => {
      expect(assetSystem).toBeInstanceOf(AssetSystem);
    });

    it("should provide access to store through getter", () => {
      const store = assetSystem["store"]; // Access private property
      expect(store).toBeDefined();
      expect(store.assets).toEqual({});
    });
  });

  describe("setAssets", () => {
    it("should set assets in the store", () => {
      const mockAssets: Record<string, Asset> = {
        "asset-1": createMockAsset(),
        "asset-2": createMockAsset({ id: "asset-2" }),
      };

      assetSystem.setAssets(mockAssets);

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual(mockAssets);
    });

    it("should replace existing assets with new assets", () => {
      const initialAssets: Record<string, Asset> = {
        "asset-1": createMockAsset(),
      };
      useWorkflowStore.setState({ assets: initialAssets });

      const newAssets: Record<string, Asset> = {
        "asset-2": createMockAsset({ id: "asset-2" }),
      };

      assetSystem.setAssets(newAssets);

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual(newAssets);
      expect(storeAssets["asset-1"]).toBeUndefined();
    });

    it("should handle empty assets object", () => {
      assetSystem.setAssets({});

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual({});
    });
  });

  describe("create", () => {
    it("should create a record asset with default options", () => {
      const valueType: ValueType = "record";
      const value = { name: "Test", count: 42 };

      const id = assetSystem.create(valueType, value);

      expect(id).toBe("mock-uuid-1234");

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets[id];

      expect(createdAsset).toBeDefined();
      expect(createdAsset?.id).toBe(id);
      expect(createdAsset?.valueType).toBe(valueType);
      expect(createdAsset?.value).toEqual(value);
      expect(createdAsset?.sys.name).toBe("New Asset");
      expect(createdAsset?.sys.source).toBe("user");
      expect(createdAsset?.sys.isLibraryAsset).toBeNull();
    });

    it("should create an array asset", () => {
      const valueType: ValueType = "array";
      const value = [1, 2, 3];

      const id = assetSystem.create(valueType, value);

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets[id];

      expect(createdAsset?.valueType).toBe("array");
      expect(createdAsset?.value).toEqual([1, 2, 3]);
    });

    it("should create asset with custom name", () => {
      const valueType: ValueType = "record";
      const value = { test: true };

      assetSystem.create(valueType, value, { name: "Custom Asset" });

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets["mock-uuid-1234"];

      expect(createdAsset?.sys.name).toBe("Custom Asset");
    });

    it("should create asset with custom config", () => {
      const valueType: ValueType = "record";
      const value = { test: true };
      const config = { schema: [{ key: "test", type: "string" }] };

      assetSystem.create(valueType, value, { config });

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets["mock-uuid-1234"];

      expect(createdAsset?.config).toEqual(config);
    });

    it("should create asset with custom source", () => {
      const valueType: ValueType = "record";
      const value = { test: true };

      assetSystem.create(valueType, value, { source: "ai" });

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets["mock-uuid-1234"];

      expect(createdAsset?.sys.source).toBe("ai");
    });

    it("should create asset with sys metadata override", () => {
      const valueType: ValueType = "record";
      const value = { test: true };

      assetSystem.create(valueType, value, {
        sys: { isLibraryAsset: true },
      });

      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets["mock-uuid-1234"];

      expect(createdAsset?.sys.isLibraryAsset).toBe(true);
    });

    it("should set createdAt and updatedAt timestamps", () => {
      const beforeTime = Date.now();
      const valueType: ValueType = "record";
      const value = { test: true };

      assetSystem.create(valueType, value);

      const afterTime = Date.now();
      const storeAssets = useWorkflowStore.getState().assets;
      const createdAsset = storeAssets["mock-uuid-1234"];

      expect(createdAsset?.sys.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(createdAsset?.sys.createdAt).toBeLessThanOrEqual(afterTime);
      expect(createdAsset?.sys.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(createdAsset?.sys.updatedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should save asset to backend on creation", async () => {
      const valueType: ValueType = "record";
      const value = { test: true };

      assetSystem.create(valueType, value);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith("save_asset", expect.anything());
    });

    it("should add new asset to existing assets", () => {
      const existingAsset = createMockAsset({ id: "existing-asset" });
      useWorkflowStore.setState({
        assets: { "existing-asset": existingAsset },
      });

      const valueType: ValueType = "record";
      const value = { new: true };

      assetSystem.create(valueType, value);

      const storeAssets = useWorkflowStore.getState().assets;

      expect(storeAssets["existing-asset"]).toEqual(existingAsset);
      expect(storeAssets["mock-uuid-1234"]).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update the value of an existing asset", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        value: { old: "value" },
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      const newValue = { new: "value" };
      assetSystem.update("asset-1", newValue);

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.value).toEqual(newValue);
    });

    it("should update the updatedAt timestamp when updating value", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        value: { old: "value" },
        sys: createMockSys({ updatedAt: 1000 }),
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      const beforeTime = Date.now();
      assetSystem.update("asset-1", { new: "value" });
      const afterTime = Date.now();

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.sys.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedAsset?.sys.updatedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should preserve other asset properties when updating value", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        value: { old: "value" },
        config: { schema: [{ key: "test", type: "string" }] },
        sys: createMockSys({ name: "Test Name" }),
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.update("asset-1", { new: "value" });

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.id).toBe("asset-1");
      expect(updatedAsset?.valueType).toBe("record");
      expect(updatedAsset?.config).toEqual({
        schema: [{ key: "test", type: "string" }],
      });
      expect(updatedAsset?.sys.name).toBe("Test Name");
      expect(updatedAsset?.sys.createdAt).toBe(existingAsset.sys.createdAt);
    });

    it("should save to backend after updating value", async () => {
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.update("asset-1", { new: "value" });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith("save_asset", expect.anything());
    });

    it("should warn when updating non-existent asset", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      assetSystem.update("non-existent-id", { value: "test" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Attempted to update non-existent asset non-existent-id",
      );

      consoleSpy.mockRestore();
    });

    it("should not modify store when updating non-existent asset", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.update("non-existent-id", { value: "test" });

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual({ "asset-1": existingAsset });

      consoleSpy.mockRestore();
    });

    it("should handle backend save failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Backend error"));

      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.update("asset-1", { new: "value" });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Store should still be updated despite backend failure
      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]?.value).toEqual({ new: "value" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Backend save skipped:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("updateConfig", () => {
    it("should update config of an existing asset", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        config: { schema: [], extra: { old: "value" } },
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      const newConfig = { extra: { new: "value" } };
      assetSystem.updateConfig("asset-1", newConfig);

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.config).toEqual({
        schema: [],
        extra: { new: "value" },
      });
    });

    it("should merge config updates with existing config (shallow merge)", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        config: {
          schema: [{ key: "existing", type: "string" }],
          extra: { existingField: "existingValue" },
        },
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateConfig("asset-1", {
        extra: { newField: "newValue" },
      });

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      // schema is preserved (not in the update)
      expect(updatedAsset?.config.schema).toEqual([
        { key: "existing", type: "string" },
      ]);
      // extra is replaced entirely (shallow merge, not deep)
      expect(updatedAsset?.config.extra).toEqual({
        newField: "newValue",
      });
    });

    it("should not update value when updating config", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        value: { original: "value" },
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateConfig("asset-1", { schema: [] });

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.value).toEqual({ original: "value" });
    });

    it("should persist to backend after updating config", async () => {
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateConfig("asset-1", { schema: [] });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith("save_asset", expect.anything());
    });

    it("should return early when asset does not exist", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateConfig("non-existent-id", { schema: [] });

      // Should not modify the store
      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual({ "asset-1": existingAsset });

      consoleSpy.mockRestore();
    });

    it("should handle backend save failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Backend error"));

      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateConfig("asset-1", { schema: [] });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Backend save skipped:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("updateSys", () => {
    it("should update system metadata", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        sys: createMockSys({ name: "Old Name", source: "user" }),
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateSys("asset-1", { name: "New Name" });

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.sys.name).toBe("New Name");
    });

    it("should merge sys updates with existing metadata", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        sys: createMockSys({
          name: "Old Name",
          source: "user",
          createdAt: 1000,
        }),
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateSys("asset-1", { source: "ai" });

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.sys.name).toBe("Old Name");
      expect(updatedAsset?.sys.source).toBe("ai");
      expect(updatedAsset?.sys.createdAt).toBe(1000);
    });

    it("should update updatedAt timestamp when updating sys", () => {
      const existingAsset = createMockAsset({
        id: "asset-1",
        sys: createMockSys({ updatedAt: 1000 }),
      });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      const beforeTime = Date.now();
      assetSystem.updateSys("asset-1", { name: "New Name" });
      const afterTime = Date.now();

      const storeAssets = useWorkflowStore.getState().assets;
      const updatedAsset = storeAssets["asset-1"];

      expect(updatedAsset?.sys.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedAsset?.sys.updatedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should persist to backend after updating sys", async () => {
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateSys("asset-1", { name: "New Name" });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith("save_asset", expect.anything());
    });

    it("should return early when asset does not exist", () => {
      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateSys("non-existent-id", { name: "New Name" });

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets).toEqual({ "asset-1": existingAsset });
    });

    it("should handle backend save failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Backend error"));

      const existingAsset = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": existingAsset } });

      assetSystem.updateSys("asset-1", { name: "New Name" });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Backend save skipped:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("delete", () => {
    it("should delete asset from store", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      const asset2 = createMockAsset({ id: "asset-2" });
      useWorkflowStore.setState({
        assets: { "asset-1": asset1, "asset-2": asset2 },
      });

      await assetSystem.delete("asset-1");

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]).toBeUndefined();
      expect(storeAssets["asset-2"]).toEqual(asset2);
    });

    it("should call backend delete with assetId and deleteFiles flag", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      await assetSystem.delete("asset-1", true);

      expect(mockInvoke).toHaveBeenCalledWith("delete_media_asset", {
        assetId: "asset-1",
        deleteFiles: true,
      });
    });

    it("should call backend delete with deleteFiles=false when specified", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      await assetSystem.delete("asset-1", false);

      expect(mockInvoke).toHaveBeenCalledWith("delete_media_asset", {
        assetId: "asset-1",
        deleteFiles: false,
      });
    });

    it("should default deleteFiles to true", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      await assetSystem.delete("asset-1");

      expect(mockInvoke).toHaveBeenCalledWith("delete_media_asset", {
        assetId: "asset-1",
        deleteFiles: true,
      });
    });

    it("should handle backend failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Backend error"));

      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      await assetSystem.delete("asset-1");

      // Store should still be updated despite backend failure
      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]).toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Backend delete skipped:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle deleting non-existent asset", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      // Should not throw
      await expect(
        assetSystem.delete("non-existent-id"),
      ).resolves.toBeUndefined();

      // Original asset should remain
      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]).toEqual(asset1);
    });
  });

  describe("cleanupOrphans", () => {
    it("should call apiClient cleanupOrphanAssets", async () => {
      vi.mocked(apiClient.cleanupOrphanAssets).mockResolvedValueOnce({
        deletedCount: 0,
        deletedAssetIds: [],
      });

      await assetSystem.cleanupOrphans();

      expect(apiClient.cleanupOrphanAssets).toHaveBeenCalled();
    });

    it("should remove deleted assets from store", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      const asset2 = createMockAsset({ id: "asset-2" });
      const asset3 = createMockAsset({ id: "asset-3" });

      useWorkflowStore.setState({
        assets: { "asset-1": asset1, "asset-2": asset2, "asset-3": asset3 },
      });

      vi.mocked(apiClient.cleanupOrphanAssets).mockResolvedValueOnce({
        deletedCount: 2,
        deletedAssetIds: ["asset-1", "asset-3"],
      });

      await assetSystem.cleanupOrphans();

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]).toBeUndefined();
      expect(storeAssets["asset-2"]).toEqual(asset2);
      expect(storeAssets["asset-3"]).toBeUndefined();
    });

    it("should return result from apiClient", async () => {
      const expectedResult = {
        deletedCount: 5,
        deletedAssetIds: [
          "asset-1",
          "asset-2",
          "asset-3",
          "asset-4",
          "asset-5",
        ],
      };

      vi.mocked(apiClient.cleanupOrphanAssets).mockResolvedValueOnce(
        expectedResult,
      );

      const result = await assetSystem.cleanupOrphans();

      expect(result).toEqual(expectedResult);
    });

    it("should not modify store when no assets are deleted", async () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      vi.mocked(apiClient.cleanupOrphanAssets).mockResolvedValueOnce({
        deletedCount: 0,
        deletedAssetIds: [],
      });

      await assetSystem.cleanupOrphans();

      const storeAssets = useWorkflowStore.getState().assets;
      expect(storeAssets["asset-1"]).toEqual(asset1);
    });

    it("should handle errors from apiClient", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("API Error");
      vi.mocked(apiClient.cleanupOrphanAssets).mockRejectedValueOnce(error);

      await expect(assetSystem.cleanupOrphans()).rejects.toThrow("API Error");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Cleanup orphans failed:",
        error,
      );

      consoleSpy.mockRestore();
    });

    it("should re-throw errors from apiClient", async () => {
      const error = new Error("Network error");
      vi.mocked(apiClient.cleanupOrphanAssets).mockRejectedValueOnce(error);

      await expect(assetSystem.cleanupOrphans()).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("get", () => {
    it("should return asset by id", () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      const result = assetSystem.get("asset-1");

      expect(result).toEqual(asset1);
    });

    it("should return undefined for non-existent asset", () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      const result = assetSystem.get("non-existent-id");

      expect(result).toBeUndefined();
    });

    it("should return undefined when store is empty", () => {
      useWorkflowStore.setState({ assets: {} });

      const result = assetSystem.get("any-id");

      expect(result).toBeUndefined();
    });

    it("should return the actual asset reference from store", () => {
      const asset1 = createMockAsset({ id: "asset-1" });
      useWorkflowStore.setState({ assets: { "asset-1": asset1 } });

      const result = assetSystem.get("asset-1");
      const storeAssets = useWorkflowStore.getState().assets;

      // Should be the same reference
      expect(result).toBe(storeAssets["asset-1"]);
    });
  });

  describe("saveAssetToBackend (private)", () => {
    it("should call Tauri invoke with save_asset command", async () => {
      useWorkflowStore.setState({ assets: {} });

      // Access private method through create (which calls it)
      assetSystem.create("record", { test: true });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith("save_asset", {
        asset: expect.objectContaining({
          id: expect.any(String),
          valueType: expect.any(String),
        }),
      });
    });

    it("should handle Tauri invoke errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Tauri not available"));

      useWorkflowStore.setState({ assets: {} });

      assetSystem.create("record", { test: true });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AssetSystem] Backend save skipped:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete asset lifecycle: create, update, updateConfig, updateSys, delete", async () => {
      // Create
      const id = assetSystem.create(
        "record",
        { initial: "value" },
        { name: "Test Asset" },
      );

      let asset = assetSystem.get(id);
      expect(asset?.value).toEqual({ initial: "value" });
      expect(asset?.sys.name).toBe("Test Asset");

      // Update value
      assetSystem.update(id, { updated: "value" });
      asset = assetSystem.get(id);
      expect(asset?.value).toEqual({ updated: "value" });

      // Update config
      assetSystem.updateConfig(id, {
        schema: [{ key: "test", type: "string" }],
      });
      asset = assetSystem.get(id);
      expect(asset?.config.schema).toEqual([{ key: "test", type: "string" }]);

      // Update sys
      assetSystem.updateSys(id, { name: "Updated Asset" });
      asset = assetSystem.get(id);
      expect(asset?.sys.name).toBe("Updated Asset");

      // Delete
      await assetSystem.delete(id);
      asset = assetSystem.get(id);
      expect(asset).toBeUndefined();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should manage multiple assets independently", () => {
      // Since uuid is mocked to return 'mock-uuid-1234', both creates would have same id
      // Let's test with get after setting state directly
      const asset1 = createMockAsset({
        id: "asset-1",
        value: { name: "Asset 1" },
      });
      const asset2 = createMockAsset({ id: "asset-2", value: [1, 2, 3] });
      useWorkflowStore.setState({
        assets: { "asset-1": asset1, "asset-2": asset2 },
      });

      expect(assetSystem.get("asset-1")).toEqual(asset1);
      expect(assetSystem.get("asset-2")).toEqual(asset2);

      // Update one should not affect the other
      assetSystem.update("asset-1", { modified: true });

      expect(assetSystem.get("asset-1")?.value).toEqual({ modified: true });
      expect(assetSystem.get("asset-2")?.value).toEqual([1, 2, 3]);
    });
  });
});
