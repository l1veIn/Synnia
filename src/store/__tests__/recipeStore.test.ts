// @ts-nocheck
/**
 * Recipe Store Tests
 * Tests for recipe metadata and manifest caching store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useRecipeStore,
  selectRecipesByCategory,
  selectRecipeById,
} from "../recipeStore";
import type { RecipeManifest } from "@/types/recipe";

// ============================================================================
// Mocks
// ============================================================================

const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockUnlistenIndexed = vi.fn();
const mockUnlistenError = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, callback: (...args: unknown[]) => void) => {
    if (event === "recipes:indexed") {
      mockListen(event, callback);
      return Promise.resolve(mockUnlistenIndexed);
    }
    if (event === "recipes:index_error") {
      mockListen(event, callback);
      return Promise.resolve(mockUnlistenError);
    }
    return Promise.resolve(vi.fn());
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockRecipeMeta = (
  overrides: Partial<
    Parameters<typeof useRecipeStore.getState>[0]["metas"][number]
  > = {},
) => ({
  id: "recipe-1",
  source: "builtin" as const,
  path: "/builtin/recipe-1",
  name: "Test Recipe 1",
  description: "A test recipe",
  category: "Test Category",
  icon: "test-icon",
  author: "Test Author",
  version: 1,
  cover: "cover.png",
  tags: ["test", "demo"],
  ...overrides,
});

const createMockManifest = (
  overrides: Partial<RecipeManifest> = {},
): RecipeManifest => ({
  version: 1,
  id: "recipe-1",
  name: "Test Recipe 1",
  description: "A test recipe",
  category: "Test Category",
  icon: "test-icon",
  author: "Test Author",
  tags: ["test", "demo"],
  cover: "cover.png",
  executor: {
    type: "agent",
    model: {
      category: "llm",
    },
  },
  output: { node: "form" },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("RecipeStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useRecipeStore.setState({
      metas: [],
      manifests: new Map(),
      isLoadingMetas: false,
      isIndexing: false,
      _loadingPromises: new Map(),
    });
    // Setup default mock listen behavior
    mockListen.mockImplementation((event, callback) => {
      if (typeof callback === "function") {
        // Store callback for later invocation in tests
        (
          callback as unknown as {
            _event: string;
            _handler: (...args: unknown[]) => void;
          }
        )._event = event as string;
        (
          callback as unknown as {
            _event: string;
            _handler: (...args: unknown[]) => void;
          }
        )._handler = callback;
      }
      return Promise.resolve(vi.fn());
    });
  });

  afterEach(() => {
    // Reset store state after each test
    useRecipeStore.setState({
      metas: [],
      manifests: new Map(),
      isLoadingMetas: false,
      isIndexing: false,
      _loadingPromises: new Map(),
    });
  });

  describe("initial state", () => {
    it("should have empty initial state", () => {
      const state = useRecipeStore.getState();

      expect(state.metas).toEqual([]);
      expect(state.manifests).toEqual(new Map());
      expect(state.isLoadingMetas).toBe(false);
      expect(state.isIndexing).toBe(false);
      expect(state._loadingPromises).toEqual(new Map());
    });
  });

  describe("loadMetas", () => {
    it("should load recipe metadata from backend", async () => {
      const mockMetas = [
        createMockRecipeMeta(),
        createMockRecipeMeta({ id: "recipe-2", name: "Test Recipe 2" }),
      ];
      mockInvoke.mockResolvedValue(mockMetas);

      const { loadMetas } = useRecipeStore.getState();
      await loadMetas();

      expect(mockInvoke).toHaveBeenCalledWith("list_indexed_recipes", {
        source: null,
        category: null,
        limit: null,
      });
      expect(useRecipeStore.getState().metas).toEqual(mockMetas);
      expect(useRecipeStore.getState().isLoadingMetas).toBe(false);
    });

    it("should set isLoadingMetas to true while loading", async () => {
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10)),
      );

      const { loadMetas } = useRecipeStore.getState();
      loadMetas();

      expect(useRecipeStore.getState().isLoadingMetas).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(useRecipeStore.getState().isLoadingMetas).toBe(false);
    });

    it("should not load if already loading", async () => {
      mockInvoke.mockResolvedValue([createMockRecipeMeta()]);

      const { loadMetas } = useRecipeStore.getState();

      // Start first load
      const firstLoad = loadMetas();
      expect(useRecipeStore.getState().isLoadingMetas).toBe(true);

      // Try to load again while first is loading
      await loadMetas();

      // invoke should only be called once
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      await firstLoad;
    });

    it("should handle loading errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("Backend error"));

      const { loadMetas } = useRecipeStore.getState();
      await loadMetas();

      expect(useRecipeStore.getState().metas).toEqual([]);
      expect(useRecipeStore.getState().isLoadingMetas).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RecipeStore] Failed to load metas:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("loadManifest", () => {
    it("should load and cache a single manifest", async () => {
      const mockManifest = createMockManifest();
      mockInvoke.mockResolvedValue(mockManifest);

      const { loadManifest } = useRecipeStore.getState();
      const result = await loadManifest("recipe-1");

      expect(mockInvoke).toHaveBeenCalledWith("get_recipe_manifest_by_id", {
        id: "recipe-1",
      });
      expect(result).toEqual(mockManifest);
      expect(useRecipeStore.getState().manifests.get("recipe-1")).toEqual(
        mockManifest,
      );
    });

    it("should return cached manifest if already loaded", async () => {
      const mockManifest = createMockManifest();
      mockInvoke.mockResolvedValue(mockManifest);

      const { loadManifest } = useRecipeStore.getState();

      // First load
      await loadManifest("recipe-1");
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Second load should use cache
      const result = await loadManifest("recipe-1");
      expect(mockInvoke).toHaveBeenCalledTimes(1); // No additional call
      expect(result).toEqual(mockManifest);
    });

    it("should prevent duplicate requests for the same manifest", async () => {
      const mockManifest = createMockManifest();
      let invokeCount = 0;
      mockInvoke.mockImplementation(async () => {
        invokeCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockManifest;
      });

      const { loadManifest } = useRecipeStore.getState();

      // Start multiple concurrent loads
      const [result1, result2, result3] = await Promise.all([
        loadManifest("recipe-1"),
        loadManifest("recipe-1"),
        loadManifest("recipe-1"),
      ]);

      // Should only call invoke once despite 3 concurrent calls
      expect(invokeCount).toBe(1);
      expect(result1).toEqual(mockManifest);
      expect(result2).toEqual(mockManifest);
      expect(result3).toEqual(mockManifest);
    });

    it("should clean up loading promise after completion", async () => {
      const mockManifest = createMockManifest();
      mockInvoke.mockResolvedValue(mockManifest);

      const { loadManifest } = useRecipeStore.getState();
      await loadManifest("recipe-1");

      expect(
        useRecipeStore.getState()._loadingPromises.get("recipe-1"),
      ).toBeUndefined();
    });

    it("should clean up loading promise after error", async () => {
      mockInvoke.mockRejectedValue(new Error("Load failed"));

      const { loadManifest } = useRecipeStore.getState();

      await expect(loadManifest("recipe-1")).rejects.toThrow("Load failed");

      expect(
        useRecipeStore.getState()._loadingPromises.get("recipe-1"),
      ).toBeUndefined();
    });

    it("should load different manifests concurrently", async () => {
      const mockManifest1 = createMockManifest({
        id: "recipe-1",
        name: "Recipe 1",
      });
      const mockManifest2 = createMockManifest({
        id: "recipe-2",
        name: "Recipe 2",
      });

      // Clear mock and set new implementation
      mockInvoke.mockReset();
      mockInvoke.mockImplementation(
        async (cmd: string, args: { id: string }) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          if (args?.id === "recipe-1") return mockManifest1;
          if (args?.id === "recipe-2") return mockManifest2;
          throw new Error("Unknown recipe");
        },
      );

      const { loadManifest } = useRecipeStore.getState();

      const [result1, result2] = await Promise.all([
        loadManifest("recipe-1"),
        loadManifest("recipe-2"),
      ]);

      expect(result1.id).toBe("recipe-1");
      expect(result2.id).toBe("recipe-2");
      expect(useRecipeStore.getState().manifests.get("recipe-1")?.id).toBe(
        "recipe-1",
      );
      expect(useRecipeStore.getState().manifests.get("recipe-2")?.id).toBe(
        "recipe-2",
      );
    });
  });

  describe("loadManifests", () => {
    it("should batch load multiple manifests", async () => {
      const mockManifest1 = createMockManifest({
        id: "recipe-1",
        name: "Recipe 1",
      });
      const mockManifest2 = createMockManifest({
        id: "recipe-2",
        name: "Recipe 2",
      });
      const mockManifest3 = createMockManifest({
        id: "recipe-3",
        name: "Recipe 3",
      });

      mockInvoke.mockReset();
      mockInvoke.mockImplementation(
        async (cmd: string, args: { id: string }) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (args?.id === "recipe-1") return mockManifest1;
          if (args?.id === "recipe-2") return mockManifest2;
          if (args?.id === "recipe-3") return mockManifest3;
          throw new Error("Unknown recipe");
        },
      );

      const { loadManifests } = useRecipeStore.getState();
      const results = await loadManifests(["recipe-1", "recipe-2", "recipe-3"]);

      expect(results).toBeInstanceOf(Map);
      expect(results.get("recipe-1")?.id).toBe("recipe-1");
      expect(results.get("recipe-2")?.id).toBe("recipe-2");
      expect(results.get("recipe-3")?.id).toBe("recipe-3");
      expect(results.size).toBe(3);
    });

    it("should deduplicate IDs in batch load", async () => {
      const mockManifest = createMockManifest();
      mockInvoke.mockResolvedValue(mockManifest);

      const { loadManifests } = useRecipeStore.getState();
      const results = await loadManifests(["recipe-1", "recipe-1", "recipe-1"]);

      // Should only call invoke once due to deduplication
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(results.size).toBe(1);
    });

    it("should handle partial failures in batch load", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const mockManifest1 = createMockManifest({
        id: "recipe-1",
        name: "Recipe 1",
      });

      mockInvoke.mockReset();
      mockInvoke.mockImplementation(
        async (cmd: string, args: { id: string }) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (args?.id === "recipe-1") return mockManifest1;
          if (args?.id === "recipe-2") throw new Error("Recipe 2 not found");
          throw new Error("Unknown recipe");
        },
      );

      const { loadManifests } = useRecipeStore.getState();
      const results = await loadManifests(["recipe-1", "recipe-2"]);

      // Should successfully load recipe-1 and handle recipe-2 failure gracefully
      expect(results.size).toBe(1);
      expect(results.get("recipe-1")?.id).toBe("recipe-1");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[RecipeStore] Failed to load manifest recipe-2:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should use cached manifests when available", async () => {
      const mockManifest = createMockManifest();
      mockInvoke.mockResolvedValue(mockManifest);

      const { loadManifest, loadManifests } = useRecipeStore.getState();

      // Load one manifest first
      await loadManifest("recipe-1");
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Batch load should use cached version
      await loadManifests(["recipe-1", "recipe-2"]);

      // Should only call invoke for recipe-2
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should return empty map for empty input", async () => {
      const { loadManifests } = useRecipeStore.getState();
      const results = await loadManifests([]);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });
  });

  describe("refreshIndex", () => {
    it("should trigger background index refresh", async () => {
      mockInvoke.mockReset();
      mockInvoke.mockResolvedValue(undefined);

      const { refreshIndex } = useRecipeStore.getState();
      await refreshIndex();

      expect(mockInvoke).toHaveBeenCalledWith(
        "sync_recipe_index_async",
        undefined,
      );
      // Note: isIndexing stays true because we don't trigger the completion event
      expect(useRecipeStore.getState().isIndexing).toBe(true);
    });

    it("should set isIndexing to true while refreshing", async () => {
      // Note: refreshIndex only sets isIndexing back to false via event callback
      // or on error. Since we're not simulating the event, isIndexing stays true.
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10)),
      );

      const { refreshIndex } = useRecipeStore.getState();
      refreshIndex();

      expect(useRecipeStore.getState().isIndexing).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 15));
      // isIndexing stays true because we don't trigger the completion event
      expect(useRecipeStore.getState().isIndexing).toBe(true);
    });

    it("should not refresh if already indexing", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { refreshIndex } = useRecipeStore.getState();

      // Start first refresh
      const firstRefresh = refreshIndex();
      expect(useRecipeStore.getState().isIndexing).toBe(true);

      // Try to refresh again
      await refreshIndex();

      // invoke should only be called once
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      await firstRefresh;
    });

    it("should handle refresh errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("Refresh failed"));

      const { refreshIndex } = useRecipeStore.getState();
      await refreshIndex();

      expect(useRecipeStore.getState().isIndexing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RecipeStore] Failed to trigger refresh:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getManifest", () => {
    it("should return cached manifest synchronously", () => {
      const mockManifest = createMockManifest();
      useRecipeStore.setState({
        manifests: new Map([["recipe-1", mockManifest]]),
      });

      const { getManifest } = useRecipeStore.getState();
      const result = getManifest("recipe-1");

      expect(result).toEqual(mockManifest);
    });

    it("should return undefined for non-existent manifest", () => {
      const { getManifest } = useRecipeStore.getState();
      const result = getManifest("non-existent");

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty cache", () => {
      useRecipeStore.setState({
        manifests: new Map(),
      });

      const { getManifest } = useRecipeStore.getState();
      const result = getManifest("recipe-1");

      expect(result).toBeUndefined();
    });
  });

  describe("setupEventListeners", () => {
    it("should setup event listeners for recipes:indexed and recipes:index_error", async () => {
      const { setupEventListeners } = useRecipeStore.getState();
      const unlisten = await setupEventListeners();

      expect(mockListen).toHaveBeenCalledWith(
        "recipes:indexed",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "recipes:index_error",
        expect.any(Function),
      );
      expect(typeof unlisten).toBe("function");
    });

    it("should reload metas when recipes:indexed event is received", async () => {
      const mockMetas = [createMockRecipeMeta()];
      mockInvoke.mockResolvedValue(mockMetas);

      const { setupEventListeners } = useRecipeStore.getState();
      await setupEventListeners();

      // Simulate indexing event
      const indexedCallback = mockListen.mock.calls.find(
        (call) => call[0] === "recipes:indexed",
      )?.[1];
      if (indexedCallback && typeof indexedCallback === "function") {
        indexedCallback({ payload: { added: 1, updated: 0, removed: 0 } });
      }

      // Wait for async loadMetas to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(useRecipeStore.getState().isIndexing).toBe(false);
    });

    it("should set isIndexing to false on recipes:index_error event", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { setupEventListeners } = useRecipeStore.getState();
      await setupEventListeners();

      // Set indexing state
      useRecipeStore.setState({ isIndexing: true });

      // Simulate error event
      const errorCallback = mockListen.mock.calls.find(
        (call) => call[0] === "recipes:index_error",
      )?.[1];
      if (errorCallback && typeof errorCallback === "function") {
        errorCallback({ payload: "Indexing failed" });
      }

      expect(useRecipeStore.getState().isIndexing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RecipeStore] Index error:",
        "Indexing failed",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return unlisten function that cleans up listeners", async () => {
      const { setupEventListeners } = useRecipeStore.getState();
      const unlisten = await setupEventListeners();

      expect(typeof unlisten).toBe("function");

      // Call unlisten
      unlisten();

      // Verify unlisten functions were called
      expect(mockUnlistenIndexed).toHaveBeenCalled();
      expect(mockUnlistenError).toHaveBeenCalled();
    });
  });

  describe("selectors", () => {
    describe("selectRecipesByCategory", () => {
      it("should group recipes by category", () => {
        const metas = [
          createMockRecipeMeta({
            id: "recipe-1",
            name: "Recipe 1",
            category: "Tools",
          }),
          createMockRecipeMeta({
            id: "recipe-2",
            name: "Recipe 2",
            category: "Tools",
          }),
          createMockRecipeMeta({
            id: "recipe-3",
            name: "Recipe 3",
            category: "Media",
          }),
          createMockRecipeMeta({
            id: "recipe-4",
            name: "Recipe 4",
            category: undefined,
          }),
        ];
        useRecipeStore.setState({ metas });

        const state = useRecipeStore.getState();
        const grouped = selectRecipesByCategory(state);

        expect(grouped.Tools).toHaveLength(2);
        expect(grouped.Media).toHaveLength(1);
        expect(grouped.Other).toHaveLength(1);
      });

      it("should handle empty metas array", () => {
        useRecipeStore.setState({ metas: [] });

        const state = useRecipeStore.getState();
        const grouped = selectRecipesByCategory(state);

        expect(grouped).toEqual({});
      });

      it("should handle recipes with same category", () => {
        const metas = [
          createMockRecipeMeta({
            id: "recipe-1",
            name: "Recipe 1",
            category: "Generation",
          }),
          createMockRecipeMeta({
            id: "recipe-2",
            name: "Recipe 2",
            category: "Generation",
          }),
          createMockRecipeMeta({
            id: "recipe-3",
            name: "Recipe 3",
            category: "Generation",
          }),
        ];
        useRecipeStore.setState({ metas });

        const state = useRecipeStore.getState();
        const grouped = selectRecipesByCategory(state);

        expect(grouped.Generation).toHaveLength(3);
      });
    });

    describe("selectRecipeById", () => {
      it("should find recipe by ID", () => {
        const metas = [
          createMockRecipeMeta({ id: "recipe-1", name: "Recipe 1" }),
          createMockRecipeMeta({ id: "recipe-2", name: "Recipe 2" }),
          createMockRecipeMeta({ id: "recipe-3", name: "Recipe 3" }),
        ];
        useRecipeStore.setState({ metas });

        const state = useRecipeStore.getState();
        const recipe = selectRecipeById("recipe-2")(state);

        expect(recipe).toEqual(metas[1]);
      });

      it("should return undefined for non-existent ID", () => {
        const metas = [
          createMockRecipeMeta({ id: "recipe-1", name: "Recipe 1" }),
        ];
        useRecipeStore.setState({ metas });

        const state = useRecipeStore.getState();
        const recipe = selectRecipeById("non-existent")(state);

        expect(recipe).toBeUndefined();
      });

      it("should return undefined for empty metas", () => {
        useRecipeStore.setState({ metas: [] });

        const state = useRecipeStore.getState();
        const recipe = selectRecipeById("recipe-1")(state);

        expect(recipe).toBeUndefined();
      });
    });
  });
});
