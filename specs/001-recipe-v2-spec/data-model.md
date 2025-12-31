# Data Model: Recipe V2

**Feature**: Recipe V2 Architecture Upgrade
**Date**: 2025-12-30

## Entities

### RecipeAsset (Extension of RecordAsset)

Represents a configured recipe instance, including its data, schema, model configuration, and conversation history.

```typescript
// src/types/assets.ts

// Existing base
interface AssetSysMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  source: string;
}

// EXTENSION: Recipe Configuration
interface RecipeAssetConfig extends RecordAssetConfig {
  // The ID of the recipe definition (e.g., 'text-generator')
  recipeId: string;

  // Form Schema (existing)
  schema: FieldDefinition[];

  // NEW: AI Model Configuration
  modelConfig?: {
    modelId: string;       // e.g., 'gpt-4-turbo'
    provider?: string;     // e.g., 'openai'
    params?: Record<string, any>; // e.g., { temperature: 0.7 }
  };

  // NEW: Conversation History
  chatContext?: {
    messages: ChatMessage[];
  };
}

// NEW: Chat Message Structure
interface ChatMessage {
  id: string;              // Unique ID
  role: 'system' | 'user' | 'assistant';
  content: string;         // Text content
  timestamp: number;
  
  // References to other assets (for multi-modal or RAG)
  attachments?: AssetReference[];
  
  // Link to generated output (for 'assistant' messages)
  outputAssetId?: string; 
}

interface AssetReference {
  assetId: string;
  type: 'image' | 'text' | 'file';
}
```

### ExecutionContext (Runtime)

The context object passed to the executor function.

```typescript
// src/features/recipes/types.ts

interface ExecutionContext {
  // Resolved inputs from Form + Connections
  inputs: Record<string, any>;
  
  // Current Node Information
  nodeId: string;
  node: SynniaNode;
  
  // Engine Access
  engine: GraphEngine;
  
  // Definition
  manifest: RecipeManifest;
  
  // NEW: History Access
  chatContext: ChatMessage[];
  
  // NEW: Model Configuration
  modelConfig: ModelConfig;
}
```

## State Transitions

### Interaction Flow

1.  **Initial Run**:
    *   `chatContext`: Empty or System Prompt only.
    *   `inputs`: From Form.
    *   **Action**: Execute -> Generate Result -> Append (User+Assistant) to `chatContext`.

2.  **Follow-up (Chat Tab)**:
    *   User inputs text in Chat Tab.
    *   **Action**: Append User Msg -> Execute (with full history) -> Generate Result -> Update/Append Output -> Append Assistant Msg.

### Port State

*   **State A (Text Model)**: `capabilities = ['chat']` -> Ports: `[Reference Output]`
*   **State B (Vision Model)**: `capabilities = ['chat', 'vision']` -> Ports: `[Reference Output, Reference Image (Input)]`
