# Synnia Bot - Code Examples & Verification

> 配合 `PRD-bot.md` 使用  
> 包含详细的代码示例、API 设计和 MCP 验证脚本

---

## Table of Contents

1. [Code Examples](#code-examples)
   - [Bot Store](#1-bot-store-srcstorebotstorots)
   - [Bot Toolkit](#2-bot-toolkit-srcfeaturesbotbottoolkitts)
   - [Bot Runtime](#3-bot-runtime-srcfeaturesbotbotruntimetsx)
   - [Bot Panel UI](#4-bot-panel-ui-srccomponentsbotbotpaneltsx)
   - [History Adapter](#5-history-adapter-srcfeaturesbotpersistencehistoryadapterts)
   - [Tauri Commands](#6-tauri-commands-src-taurisrccommandsbotrs)

2. [MCP Verification Scripts](#mcp-verification-scripts)

---

## Code Examples

### 1. Bot Store (`src/store/botStore.ts`)

```typescript
import { create } from 'zustand';
import { useWorkflowStore } from './workflowStore';

interface ConfirmDialogState {
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

interface BotState {
  // Panel state
  isPanelOpen: boolean;
  
  // Confirm dialog state
  confirmDialog: ConfirmDialogState;
  
  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  
  // Confirm dialog actions
  showConfirmDialog: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
  closeConfirmDialog: () => void;
}

export const useBotStore = create<BotState>()((set, get) => ({
  isPanelOpen: false,
  
  confirmDialog: {
    open: false,
    message: '',
    onConfirm: null,
    onCancel: null,
  },
  
  togglePanel: () => {
    const { isPanelOpen } = get();
    
    if (!isPanelOpen) {
      // Opening Bot Panel -> close Properties Panel
      useWorkflowStore.getState().setSelectedNode(null);
    }
    
    set({ isPanelOpen: !isPanelOpen });
  },
  
  openPanel: () => {
    useWorkflowStore.getState().setSelectedNode(null);
    set({ isPanelOpen: true });
  },
  
  closePanel: () => {
    set({ isPanelOpen: false });
  },
  
  showConfirmDialog: (message, onConfirm, onCancel) => {
    set({
      confirmDialog: {
        open: true,
        message,
        onConfirm,
        onCancel: onCancel || null,
      },
    });
  },
  
  closeConfirmDialog: () => {
    set({
      confirmDialog: { open: false, message: '', onConfirm: null, onCancel: null },
    });
  },
}));
```

---

### 2. Bot Toolkit (`src/features/bot/BotToolkit.ts`)

```typescript
import { graphEngine } from '@/core/engine/GraphEngine';
import { useBotStore } from '@/store/botStore';
import { z } from 'zod';

// Helper: 显示确认对话框并返回 Promise
function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    useBotStore.getState().showConfirmDialog(
      message,
      () => {
        useBotStore.getState().closeConfirmDialog();
        resolve(true);
      },
      () => {
        useBotStore.getState().closeConfirmDialog();
        resolve(false);
      }
    );
  });
}

export const BOT_TOOLS = [
  // 1. Get nodes list
  {
    name: 'get_nodes_list',
    description: 'Get a list of all nodes on the canvas with their IDs, types, positions, and asset IDs',
    parameters: z.object({}),
    execute: async () => {
      const { nodes } = graphEngine.state;
      return nodes.map(n => ({
        id: n.id,
        type: n.type,
        title: n.data.title,
        state: n.data.state,
        position: n.position,
        assetId: n.data.assetId,
      }));
    },
  },

  // 2. Get asset details
  {
    name: 'get_asset_details',
    description: 'Get detailed information about one or more assets by their IDs',
    parameters: z.object({
      assetIds: z.array(z.string()).describe('Array of asset IDs to retrieve'),
    }),
    execute: async ({ assetIds }: { assetIds: string[] }) => {
      return assetIds.map(id => {
        const asset = graphEngine.assets.get(id);
        if (!asset) {
          return { id, error: 'Asset not found' };
        }
        return asset;
      });
    },
  },

  // 3. Create node (smart)
  {
    name: 'create_node_smart',
    description: 'Create a new node on the canvas using smart type inference',
    parameters: z.object({
      nodeType: z.enum(['text', 'image', 'form', 'recipe', 'selector', 'gallery', 'table'])
        .describe('Type of node to create'),
      value: z.any().describe('Content/value for the node'),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional().describe('Position on canvas (defaults to (100, 100))'),
    }),
    execute: async ({
      nodeType,
      value,
      position,
    }: {
      nodeType: string;
      value: any;
      position?: { x: number; y: number };
    }) => {
      const nodeId = graphEngine.mutator.createSmart({
        nodeType: nodeType as any,
        value,
        position: position || { x: 100, y: 100 },
      });
      
      return {
        success: true,
        nodeId,
        message: `Created ${nodeType} node with ID: ${nodeId}`,
      };
    },
  },

  // 4. Update nodes
  {
    name: 'update_nodes',
    description: 'Update one or more nodes with new data',
    parameters: z.object({
      updates: z.array(
        z.object({
          id: z.string().describe('Node ID to update'),
          data: z.record(z.any()).describe('Partial node data to merge'),
        })
      ).describe('Array of updates to apply'),
    }),
    execute: async ({ updates }: { updates: Array<{ id: string; data: Record<string, any> }> }) => {
      const results = [];
      
      for (const { id, data } of updates) {
        try {
          graphEngine.updateNode(id, { data });
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: String(error) });
        }
      }
      
      return {
        totalUpdated: results.filter(r => r.success).length,
        results,
      };
    },
  },

  // 5. Update assets
  {
    name: 'update_assets',
    description: 'Update one or more assets with new values',
    parameters: z.object({
      updates: z.array(
        z.object({
          id: z.string().describe('Asset ID to update'),
          value: z.any().describe('New value for the asset'),
        })
      ).describe('Array of asset updates'),
    }),
    execute: async ({ updates }: { updates: Array<{ id: string; value: any }> }) => {
      const results = [];
      
      for (const { id, value } of updates) {
        try {
          await graphEngine.assets.update(id, value);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: String(error) });
        }
      }
      
      return {
        totalUpdated: results.filter(r => r.success).length,
        results,
      };
    },
  },

  // 6. Delete nodes (requires confirmation)
  {
    name: 'delete_nodes',
    description: 'Delete one or more nodes from the canvas (DANGEROUS - requires user confirmation)',
    parameters: z.object({
      nodeIds: z.array(z.string()).describe('Array of node IDs to delete'),
    }),
    execute: async ({ nodeIds }: { nodeIds: string[] }) => {
      // Show confirmation dialog
      const confirmed = await showConfirmDialog(
        `Are you sure you want to delete ${nodeIds.length} node(s)?\n\nNode IDs: ${nodeIds.join(', ')}`
      );
      
      if (!confirmed) {
        return {
          success: false,
          message: 'Deletion cancelled by user',
        };
      }
      
      // Proceed with deletion
      graphEngine.deleteNodes(nodeIds);
      
      return {
        success: true,
        deletedCount: nodeIds.length,
        message: `Successfully deleted ${nodeIds.length} node(s)`,
      };
    },
  },
];
```

---

### 3. Bot Runtime (`src/features/bot/BotRuntime.tsx`)

```typescript
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { BOT_TOOLS } from './BotToolkit';
import { createHistoryAdapter } from './persistence/historyAdapter';
import { ReactNode } from 'react';

const SYSTEM_PROMPT = `
You are an AI assistant embedded in Synnia, a visual workflow canvas application.

Your role is to help users interact with the canvas through natural language. You can:
- View all nodes and their details
- Create new nodes (text, image, form, recipe, selector, gallery, table)
- Update existing nodes and assets
- Delete nodes (with user confirmation)

Guidelines:
- Always call \`get_nodes_list\` first to understand the current canvas state
- Be concise and clear in your responses
- When creating nodes, use smart positioning to avoid overlaps
- For destructive operations (delete), always confirm with the user
- Provide helpful context about what you did

Current canvas context:
- The user is working on a Synnia project
- You have access to the GraphEngine for all operations
`.trim();

export function BotRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useChatRuntime({
    api: '/api/bot/chat', // This will be handled by Tauri command
    initialMessages: [],
    
    // System prompt
    systemMessage: SYSTEM_PROMPT,
    
    // Tools
    tools: BOT_TOOLS.reduce((acc, tool) => {
      acc[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      };
      return acc;
    }, {} as any),
    
    // History persistence
    adapter: createHistoryAdapter(),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

---

### 4. Bot Panel UI (`src/components/bot/BotPanel.tsx`)

```typescript
import { useBotStore } from '@/store/botStore';
import { Thread } from '@assistant-ui/react';
import { MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotRuntimeProvider } from '@/features/bot/BotRuntime';
import { ConfirmDialog } from './ConfirmDialog';

function BotHandle() {
  const { togglePanel } = useBotStore();
  
  return (
    <button
      onClick={togglePanel}
      className="fixed left-0 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground p-2 rounded-r-md shadow-lg hover:bg-primary/90 transition-colors z-50"
      aria-label="Toggle Bot Panel"
    >
      <MessageSquare className="w-5 h-5" />
    </button>
  );
}

export function BotPanel() {
  const { isPanelOpen, closePanel } = useBotStore();

  if (!isPanelOpen) {
    return <BotHandle />;
  }

  return (
    <BotRuntimeProvider>
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-[400px] bg-background border-r shadow-lg',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out z-40',
          isPanelOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h2 className="font-semibold">AI Assistant</h2>
          </div>
          <button
            onClick={closePanel}
            className="p-1 rounded hover:bg-muted"
            aria-label="Close Bot Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Thread */}
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </aside>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
      
      {/* Handle (always visible for quick access) */}
      <BotHandle />
    </BotRuntimeProvider>
  );
}
```

#### ConfirmDialog Component

```typescript
// src/components/bot/ConfirmDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBotStore } from '@/store/botStore';

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useBotStore();
  const { open, message, onConfirm, onCancel } = confirmDialog;

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
    closeConfirmDialog();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 5. History Adapter (`src/features/bot/persistence/historyAdapter.ts`)

```typescript
import { HistoryAdapter } from '@assistant-ui/react';
import { apiClient } from '@/lib/apiClient';

export function createHistoryAdapter(): HistoryAdapter {
  return {
    async save(messages) {
      const timestamp = Date.now();
      
      // Call Tauri command to save history
      await apiClient.invoke('save_bot_history', {
        timestamp,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: Date.now(),
          toolCalls: m.toolCalls || [],
        })),
      });
    },

    async load() {
      try {
        // Call Tauri command to load the latest history
        const history = await apiClient.invoke<any[]>('load_bot_history');
        
        return history || [];
      } catch (error) {
        console.error('Failed to load bot history:', error);
        return [];
      }
    },
  };
}
```

---

### 6. Tauri Commands (`src-tauri/src/commands/bot.rs`)

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
struct BotMessage {
    role: String,
    content: String,
    timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BotHistory {
    id: String,
    created_at: i64,
    updated_at: i64,
    messages: Vec<BotMessage>,
}

/// Get the bot chat directory for the current project
fn get_chat_dir(project_root: &PathBuf) -> PathBuf {
    project_root.join(".synnia").join("chat")
}

/// Save bot conversation history
#[tauri::command]
pub async fn save_bot_history(
    project_root: State<'_, PathBuf>,
    timestamp: i64,
    messages: Vec<BotMessage>,
) -> Result<(), String> {
    let chat_dir = get_chat_dir(&project_root);
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&chat_dir).map_err(|e| e.to_string())?;
    
    let filename = format!("{}.json", timestamp);
    let filepath = chat_dir.join(filename);
    
    let history = BotHistory {
        id: format!("chat_{}", timestamp),
        created_at: timestamp,
        updated_at: chrono::Utc::now().timestamp_millis(),
        messages,
    };
    
    let json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    fs::write(filepath, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Load the most recent bot conversation history
#[tauri::command]
pub async fn load_bot_history(
    project_root: State<'_, PathBuf>,
) -> Result<Vec<BotMessage>, String> {
    let chat_dir = get_chat_dir(&project_root);
    
    if !chat_dir.exists() {
        return Ok(vec![]);
    }
    
    // Find the most recent file
    let mut entries: Vec<_> = fs::read_dir(&chat_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s == "json")
                .unwrap_or(false)
        })
        .collect();
    
    entries.sort_by_key(|e| e.metadata().unwrap().modified().unwrap());
    
    if let Some(latest) = entries.last() {
        let content = fs::read_to_string(latest.path()).map_err(|e| e.to_string())?;
        let history: BotHistory = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        
        Ok(history.messages)
    } else {
        Ok(vec![])
    }
}

/// List all bot conversation sessions
#[tauri::command]
pub async fn list_bot_sessions(
    project_root: State<'_, PathBuf>,
) -> Result<Vec<String>, String> {
    let chat_dir = get_chat_dir(&project_root);
    
    if !chat_dir.exists() {
        return Ok(vec![]);
    }
    
    let sessions: Vec<String> = fs::read_dir(&chat_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            e.path()
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
        })
        .collect();
    
    Ok(sessions)
}
```

**注册命令** (in `src-tauri/src/main.rs`):

```rust
mod commands;
use commands::bot::{save_bot_history, load_bot_history, list_bot_sessions};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... other commands
            save_bot_history,
            load_bot_history,
            list_bot_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## MCP Verification Scripts

### Phase 2: Bot Panel UI Verification

```typescript
// Using Tauri MCP for screenshot and click testing

// 1. Screenshot: Bot Panel closed (Handle visible)
await mcp.screenshot({
  name: 'bot-panel-closed',
  description: 'Bot Panel in closed state, only Handle visible on the left',
});

// 2. Click: Open Bot Panel
await mcp.click({
  selector: 'button[aria-label="Toggle Bot Panel"]',
  description: 'Click Bot Handle to open panel',
});

// 3. Wait for animation
await mcp.wait(500);

// 4. Screenshot: Bot Panel open
await mcp.screenshot({
  name: 'bot-panel-open',
  description: 'Bot Panel fully open, 400px width',
});

// 5. Click: Close Bot Panel
await mcp.click({
  selector: 'button[aria-label="Close Bot Panel"]',
  description: 'Click close button in panel header',
});
```

### Phase 3: Panel Exclusivity Verification

```typescript
// 1. Open Bot Panel
await mcp.click({
  selector: 'button[aria-label="Toggle Bot Panel"]',
});

await mcp.wait(300);

// 2. Verify Properties Panel is closed
await mcp.assert({
  selector: '[data-testid="properties-panel"]',
  visible: false,
  description: 'Properties Panel should be closed when Bot Panel is open',
});

// 3. Click a node on canvas (this should open Properties Panel)
await mcp.click({
  selector: '[data-node-id="some-node-id"]',
});

await mcp.wait(300);

// 4. Verify Bot Panel is now closed
await mcp.assert({
  selector: '[data-testid="bot-panel"]',
  className: { includes: '-translate-x-full' },
  description: 'Bot Panel should be closed when Properties Panel opens',
});
```

### Phase 5: Tool Execution Verification

```typescript
// Test: get_nodes_list
await mcp.click({ selector: 'button[aria-label="Toggle Bot Panel"]' });
await mcp.wait(300);

// Type in the input
await mcp.type({
  selector: 'input[placeholder*="message"]',
  text: 'List all nodes on the canvas',
});

// Submit
await mcp.keyboard({ key: 'Enter' });

// Wait for response
await mcp.waitFor({
  selector: '[data-message-role="assistant"]',
  timeout: 5000,
  description: 'Wait for assistant response',
});

// Screenshot: Response with node list
await mcp.screenshot({
  name: 'bot-tool-get-nodes-list',
  description: 'Bot response showing all canvas nodes',
});

// Test: create_node_smart
await mcp.type({
  selector: 'input[placeholder*="message"]',
  text: 'Create a text node with content "Hello from Bot"',
});

await mcp.keyboard({ key: 'Enter' });
await mcp.wait(2000);

// Verify node was created on canvas
await mcp.assert({
  selector: '[data-node-type="text"]',
  text: { includes: 'Hello from Bot' },
  description: 'New text node should appear on canvas',
});

// Screenshot: New node created
await mcp.screenshot({
  name: 'bot-tool-create-node',
  description: 'Canvas showing newly created text node',
});
```

### Phase 6: Persistence Verification

```typescript
// 1. Have a conversation with the bot
await mcp.click({ selector: 'button[aria-label="Toggle Bot Panel"]' });

await mcp.type({
  selector: 'input[placeholder*="message"]',
  text: 'Hello, can you see me?',
});
await mcp.keyboard({ key: 'Enter' });
await mcp.wait(2000);

// 2. Check if history file exists
const chatDir = await mcp.invoke('read_dir', {
  path: '{project}/.synnia/chat',
});

await mcp.assert({
  value: chatDir.entries.length,
  greaterThan: 0,
  description: 'Chat history files should exist',
});

// 3. Read the latest history file
const latestFile = chatDir.entries[chatDir.entries.length - 1];
const content = await mcp.invoke('read_file', {
  path: `{project}/.synnia/chat/${latestFile}`,
});

const history = JSON.parse(content);

await mcp.assert({
  value: history.messages.length,
  greaterThan: 0,
  description: 'History should contain messages',
});

// 4. Reload the page
await mcp.reload();
await mcp.wait(2000);

// 5. Open Bot Panel
await mcp.click({ selector: 'button[aria-label="Toggle Bot Panel"]' });

// 6. Verify messages are restored
await mcp.assert({
  selector: '[data-message-content]',
  count: { greaterThan: 0 },
  description: 'Previous messages should be visible',
});

// Screenshot: Restored conversation
await mcp.screenshot({
  name: 'bot-history-restored',
  description: 'Bot Panel showing restored conversation history',
});
```

### Phase 7: Delete Confirmation Verification

```typescript
// 1. Create a test node
await mcp.invoke('create_node', {
  type: 'text',
  data: { content: 'Test Node' },
});

const nodeId = 'test-node-id';

// 2. Ask bot to delete it
await mcp.click({ selector: 'button[aria-label="Toggle Bot Panel"]' });

await mcp.type({
  selector: 'input[placeholder*="message"]',
  text: `Delete node ${nodeId}`,
});
await mcp.keyboard({ key: 'Enter' });
await mcp.wait(1000);

// 3. Verify confirm dialog appears
await mcp.assert({
  selector: '[role="dialog"]',
  visible: true,
  text: { includes: 'Are you sure' },
  description: 'Confirmation dialog should appear',
});

// Screenshot: Confirm dialog
await mcp.screenshot({
  name: 'bot-delete-confirm-dialog',
  description: 'Confirmation dialog for node deletion',
});

// 4. Click Cancel
await mcp.click({
  selector: 'button:has-text("Cancel")',
});

await mcp.wait(500);

// 5. Verify node still exists
await mcp.assert({
  selector: `[data-node-id="${nodeId}"]`,
  visible: true,
  description: 'Node should still exist after cancellation',
});

// 6. Try again and confirm
await mcp.type({
  selector: 'input[placeholder*="message"]',
  text: `Delete node ${nodeId}`,
});
await mcp.keyboard({ key: 'Enter' });
await mcp.wait(1000);

await mcp.click({
  selector: 'button:has-text("Confirm")',
});

await mcp.wait(500);

// 7. Verify node is deleted
await mcp.assert({
  selector: `[data-node-id="${nodeId}"]`,
  visible: false,
  description: 'Node should be deleted after confirmation',
});
```

---

## Keyboard Shortcut Verification

```typescript
// Test Cmd+K shortcut

// 1. Start with panel closed
await mcp.assert({
  selector: '[data-testid="bot-panel"]',
  className: { includes: '-translate-x-full' },
});

// 2. Press Cmd+K
await mcp.keyboard({
  key: 'k',
  modifiers: ['meta'], // Use 'ctrl' on Windows/Linux
});

await mcp.wait(300);

// 3. Verify panel is open
await mcp.assert({
  selector: '[data-testid="bot-panel"]',
  className: { includes: 'translate-x-0' },
  description: 'Bot Panel should open with Cmd+K',
});

// 4. Press Cmd+K again
await mcp.keyboard({
  key: 'k',
  modifiers: ['meta'],
});

await mcp.wait(300);

// 5. Verify panel is closed
await mcp.assert({
  selector: '[data-testid="bot-panel"]',
  className: { includes: '-translate-x-full' },
  description: 'Bot Panel should close with Cmd+K',
});
```

---

## Integration with CanvasPage

```typescript
// src/pages/Canvas.tsx

import { BotPanel } from '@/components/bot/BotPanel';

export function Canvas() {
  // ... existing code
  
  return (
    <div className="relative w-full h-full">
      {/* Bot Panel (left side) */}
      <BotPanel />
      
      {/* Main Canvas Area */}
      <ReactFlowProvider>
        <WorkflowCanvas />
      </ReactFlowProvider>
      
      {/* Properties Panel (right side) */}
      <PropertiesPanel />
    </div>
  );
}
```

---

## Notes

- 所有 MCP 验证脚本均为示例，需根据实际 Tauri MCP 实现调整
- 确保在 Tauri 的 `tauri.conf.json` 中注册所有新增的命令
- `apiClient.invoke` 需要在 `src/lib/apiClient.ts` 中添加对应的类型定义
- assistant-ui 的样式可通过 CSS 变量进一步自定义
- 对话历史文件格式参考 Cursor 的设计（JSON，timestamped）
