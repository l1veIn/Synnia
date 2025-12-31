# Quickstart: Recipe V2 Development

**Feature**: Recipe V2 Architecture Upgrade
**Branch**: `001-recipe-v2-spec`

## Overview

This guide explains how to work with the new Recipe V2 architecture, focusing on the Data Model changes and Inspector UI.

## 1. Setup

Ensure you are on the correct branch:

```bash
git checkout 001-recipe-v2-spec
```

## 2. Working with RecipeAsset

The `RecipeAsset` now holds critical state in its `config` property.

**Reading Chat History:**

```typescript
import { useAsset } from '@/hooks/useAsset';

const { asset } = useAsset(node.data.assetId);
const history = asset?.config?.chatContext?.messages || [];
```

**Updating Model Config:**

```typescript
// In Inspector/ModelTab.tsx
const updateModel = (modelId: string) => {
  updateAssetConfig(assetId, (prev) => ({
    ...prev,
    modelConfig: { ...prev.modelConfig, modelId }
  }));
};
```

## 3. Developing Inspector Tabs

The Inspector is now split. Navigate to `src/components/workflow/nodes/RecipeNode/Inspector/`.

*   **FormTab.tsx**: Standard form inputs (wraps `FormRenderer`).
*   **ModelTab.tsx**: Model selector (uses `ModelConfigurator`).
*   **ChatTab.tsx**: Chat interface (MessageList + Input).
*   **AdvancedTab.tsx**: System prompts and raw JSON view.

## 4. Testing Execution

To test the multi-turn capability:

1.  Open the **Synnia Canvas**.
2.  Add a **Recipe Node**.
3.  Select a recipe (e.g., "Text Generator").
4.  In **Model Tab**, select a Chat model.
5.  Run it once via **Form Tab** or Node Header.
6.  Switch to **Chat Tab**, type "Make it shorter", and send.
7.  Verify the output updates and history is preserved.
