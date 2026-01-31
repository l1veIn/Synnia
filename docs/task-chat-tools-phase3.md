# 任务：Chat 工具调用 - Phase 3

## 目标

实现 6 个核心工具，让 AI 可以操作画布和资产。

**Phase 3 范围：**
- ✅ 6 个核心工具实现
- ✅ 每个工具的自定义 UI 卡片
- ✅ Human-in-the-loop 确认流程（delete_nodes）
- ❌ 复杂工具（recipe 执行等）

## 必读参考 Skills

实现前**必须**阅读以下 skills：

- `.agents/skills/tools/SKILL.md` - 工具系统概述
  - `.agents/skills/tools/references/make-tool.md` - `makeAssistantTool` API
  - `.agents/skills/tools/references/tool-ui.md` - `makeAssistantToolUI` 自定义 UI
  - `.agents/skills/tools/references/human-in-loop.md` - 确认流程

## 架构设计

```
src/features/chat/tools/
├── index.ts                   # 导出所有工具组件
├── get-nodes-list.tsx         # Tool + ToolUI 在同一文件
├── get-asset-details.tsx
├── create-node-smart.tsx
├── update-nodes.tsx
├── update-assets.tsx
├── delete-nodes.tsx           # 包含 Human-in-loop UI
└── ChatToolsProvider.tsx      # 注册所有工具的 Provider
```

**每个工具文件包含两部分：**
1. `makeAssistantTool` - 工具定义（execute 逻辑）
2. `makeAssistantToolUI` - 工具 UI（render 逻辑）

## 依赖的 GraphEngine API

```typescript
import { graphEngine } from '@core/engine/GraphEngine';

// 状态读取
graphEngine.state.nodes        // SynniaNode[]
graphEngine.state.assets       // Record<string, Asset>

// 节点操作
graphEngine.mutator.createSmart(spec)   // 创建节点
graphEngine.updateNodes(updates)        // 批量更新节点
graphEngine.deleteNodes(nodeIds)        // 删除节点

// 资产操作
graphEngine.assets.get(id)              // 获取资产
graphEngine.assets.update(id, value)    // 更新资产
```

## 工具定义

### 1. get_nodes_list

**用途**：获取画布上所有节点的列表

```typescript
// src/features/chat/tools/definitions/get-nodes-list.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const GetNodesListTool = makeAssistantTool({
  toolName: "get_nodes_list",
  description: "Get a list of all nodes on the canvas with their basic information",
  parameters: z.object({}),
  execute: async () => {
    const nodes = graphEngine.state.nodes;
    
    return nodes.map(node => ({
      id: node.id,
      type: node.type,
      title: node.data?.title || node.data?.sys?.name || "Untitled",
      state: node.data?.state || "idle",
      position: node.position,
      assetId: node.data?.assetId,
    }));
  },
});
```

**UI 组件**：

```tsx
// src/features/chat/tools/ui/NodeListUI.tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

interface NodeInfo {
  id: string;
  type: string;
  title: string;
  state: string;
  position: { x: number; y: number };
  assetId?: string;
}

export const NodeListUI = makeAssistantToolUI<{}, NodeInfo[]>({
  toolName: "get_nodes_list",
  render: ({ result, status }) => {
    if (status === "running") {
      return <div className="animate-pulse p-3">获取节点列表...</div>;
    }
    
    if (!result || result.length === 0) {
      return (
        <div className="p-3 text-muted-foreground text-sm">
          画布上没有节点
        </div>
      );
    }
    
    return (
      <div className="border rounded-lg overflow-hidden my-2">
        <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
          节点列表 ({result.length})
        </div>
        <div className="divide-y max-h-64 overflow-y-auto">
          {result.map(node => (
            <div key={node.id} className="px-3 py-2 text-sm flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {node.id.slice(0, 8)}
              </span>
              <span className="font-medium">{node.title}</span>
              <span className="text-muted-foreground">({node.type})</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
```

---

### 2. get_asset_details

**用途**：获取一个或多个资产的详细信息

```typescript
// src/features/chat/tools/definitions/get-asset-details.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const GetAssetDetailsTool = makeAssistantTool({
  toolName: "get_asset_details",
  description: "Get detailed information about one or more assets by their IDs",
  parameters: z.object({
    assetIds: z.array(z.string()).describe("Array of asset IDs to retrieve"),
  }),
  execute: async ({ assetIds }) => {
    const assets = graphEngine.state.assets;
    
    return assetIds.map(id => {
      const asset = assets[id];
      if (!asset) {
        return { id, error: "Asset not found" };
      }
      
      return {
        id: asset.id,
        valueType: asset.valueType,
        name: asset.sys?.name || "Untitled",
        source: asset.sys?.source,
        createdAt: asset.sys?.createdAt,
        updatedAt: asset.sys?.updatedAt,
        // Truncate large values for LLM context
        valuePreview: typeof asset.value === 'string' 
          ? asset.value.slice(0, 200) 
          : JSON.stringify(asset.value).slice(0, 200),
      };
    });
  },
});
```

---

### 3. create_node_smart

**用途**：创建新节点

```typescript
// src/features/chat/tools/definitions/create-node-smart.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const CreateNodeSmartTool = makeAssistantTool({
  toolName: "create_node_smart",
  description: "Create a new node on the canvas. The node type determines its behavior.",
  parameters: z.object({
    nodeType: z.string().describe("Node type, e.g., 'text', 'image', 'recipe:xxx'"),
    value: z.any().optional().describe("Initial value for the node's asset"),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe("Position on canvas. If not provided, auto-positioned."),
  }),
  execute: async ({ nodeType, value, position }) => {
    const nodeId = graphEngine.mutator.createSmart({
      node: nodeType,
      value: value ?? {},
      position: position ?? { x: 200, y: 200 },
    });
    
    const createdNode = graphEngine.state.nodes.find(n => n.id === nodeId);
    
    return {
      success: true,
      nodeId,
      type: createdNode?.type,
      title: createdNode?.data?.title || "New Node",
    };
  },
});
```

**UI 组件**：

```tsx
// src/features/chat/tools/ui/CreateNodeUI.tsx
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Check, Plus } from "lucide-react";

export const CreateNodeUI = makeAssistantToolUI({
  toolName: "create_node_smart",
  render: ({ args, result, status }) => {
    if (status === "running") {
      return (
        <div className="flex items-center gap-2 p-3 border rounded-lg my-2 bg-muted/50">
          <Plus className="size-4 animate-pulse" />
          <span>创建节点: {args.nodeType}...</span>
        </div>
      );
    }
    
    if (result?.success) {
      return (
        <div className="flex items-center gap-2 p-3 border rounded-lg my-2 bg-green-50 dark:bg-green-950/30">
          <Check className="size-4 text-green-500" />
          <span>已创建: <strong>{result.title}</strong></span>
          <span className="text-xs text-muted-foreground">({result.nodeId.slice(0, 8)})</span>
        </div>
      );
    }
    
    return null;
  },
});
```

---

### 4. update_nodes

**用途**：批量更新节点数据

```typescript
// src/features/chat/tools/definitions/update-nodes.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const UpdateNodesTool = makeAssistantTool({
  toolName: "update_nodes",
  description: "Update data of one or more nodes. Only the specified fields will be changed.",
  parameters: z.object({
    updates: z.array(z.object({
      id: z.string().describe("Node ID to update"),
      data: z.record(z.any()).describe("Partial data to merge into node.data"),
    })),
  }),
  execute: async ({ updates }) => {
    const results = updates.map(({ id, data }) => {
      const node = graphEngine.state.nodes.find(n => n.id === id);
      if (!node) {
        return { id, success: false, error: "Node not found" };
      }
      
      graphEngine.updateNode(id, {
        data: { ...node.data, ...data }
      });
      
      return { id, success: true };
    });
    
    return {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});
```

---

### 5. update_assets

**用途**：批量更新资产值

```typescript
// src/features/chat/tools/definitions/update-assets.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const UpdateAssetsTool = makeAssistantTool({
  toolName: "update_assets",
  description: "Update the value of one or more assets.",
  parameters: z.object({
    updates: z.array(z.object({
      id: z.string().describe("Asset ID to update"),
      value: z.any().describe("New value for the asset"),
    })),
  }),
  execute: async ({ updates }) => {
    const results = updates.map(({ id, value }) => {
      const asset = graphEngine.assets.get(id);
      if (!asset) {
        return { id, success: false, error: "Asset not found" };
      }
      
      graphEngine.assets.update(id, value);
      return { id, success: true };
    });
    
    return {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});
```

---

### 6. delete_nodes (Human-in-the-loop)

**用途**：删除节点（需要用户确认）

```typescript
// src/features/chat/tools/definitions/delete-nodes.ts
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";

export const DeleteNodesTool = makeAssistantTool({
  toolName: "delete_nodes",
  description: "Delete one or more nodes from the canvas. Requires user confirmation.",
  parameters: z.object({
    nodeIds: z.array(z.string()).describe("Array of node IDs to delete"),
  }),
  execute: async ({ nodeIds }) => {
    // 注意：实际删除在 UI 确认后执行
    // 这里返回待删除的节点信息供用户确认
    const nodes = graphEngine.state.nodes;
    const toDelete = nodeIds
      .map(id => nodes.find(n => n.id === id))
      .filter(Boolean);
    
    return {
      pending: true,
      nodes: toDelete.map(n => ({
        id: n!.id,
        title: n!.data?.title || n!.data?.sys?.name || "Untitled",
        type: n!.type,
      })),
    };
  },
});
```

**UI 组件（带确认）**：

```tsx
// src/features/chat/tools/ui/DeleteNodesUI.tsx
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Trash2, AlertTriangle, Check, X } from "lucide-react";
import { graphEngine } from "@core/engine/GraphEngine";
import { Button } from "@/components/ui/button";

export const DeleteNodesUI = makeAssistantToolUI({
  toolName: "delete_nodes",
  render: ({ args, result, status, submitResult }) => {
    // 等待用户确认
    if (status === "requires-action" || (result?.pending && status === "complete")) {
      const nodes = result?.nodes || [];
      
      const handleConfirm = () => {
        // 执行实际删除
        graphEngine.deleteNodes(args.nodeIds);
        submitResult({ confirmed: true, deleted: args.nodeIds.length });
      };
      
      const handleCancel = () => {
        submitResult({ confirmed: false, deleted: 0 });
      };
      
      return (
        <div className="border border-destructive/50 rounded-lg p-4 my-2 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive mb-3">
            <AlertTriangle className="size-5" />
            <span className="font-medium">确认删除以下节点？</span>
          </div>
          
          <div className="space-y-1 mb-4">
            {nodes.map((node: any) => (
              <div key={node.id} className="flex items-center gap-2 text-sm">
                <Trash2 className="size-3 text-muted-foreground" />
                <span>{node.title}</span>
                <span className="text-muted-foreground">({node.type})</span>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleConfirm}>
              <Check className="size-4 mr-1" />
              确认删除
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="size-4 mr-1" />
              取消
            </Button>
          </div>
        </div>
      );
    }
    
    // 已完成
    if (result && !result.pending) {
      if (result.confirmed) {
        return (
          <div className="flex items-center gap-2 p-3 border rounded-lg my-2 text-destructive">
            <Trash2 className="size-4" />
            <span>已删除 {result.deleted} 个节点</span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-2 p-3 border rounded-lg my-2 text-muted-foreground">
            <X className="size-4" />
            <span>删除操作已取消</span>
          </div>
        );
      }
    }
    
    return null;
  },
});
```

---

## ChatToolsProvider

集中注册所有工具：

```tsx
// src/features/chat/tools/ChatToolsProvider.tsx
import { ReactNode } from 'react';

// Tool definitions
import { GetNodesListTool } from './definitions/get-nodes-list';
import { GetAssetDetailsTool } from './definitions/get-asset-details';
import { CreateNodeSmartTool } from './definitions/create-node-smart';
import { UpdateNodesTool } from './definitions/update-nodes';
import { UpdateAssetsTool } from './definitions/update-assets';
import { DeleteNodesTool } from './definitions/delete-nodes';

// Tool UIs
import { NodeListUI } from './ui/NodeListUI';
import { AssetDetailsUI } from './ui/AssetDetailsUI';
import { CreateNodeUI } from './ui/CreateNodeUI';
import { UpdateNodesUI } from './ui/UpdateNodesUI';
import { UpdateAssetsUI } from './ui/UpdateAssetsUI';
import { DeleteNodesUI } from './ui/DeleteNodesUI';

interface ChatToolsProviderProps {
  children: ReactNode;
}

export function ChatToolsProvider({ children }: ChatToolsProviderProps) {
  return (
    <>
      {/* Tool definitions (register execute functions) */}
      <GetNodesListTool />
      <GetAssetDetailsTool />
      <CreateNodeSmartTool />
      <UpdateNodesTool />
      <UpdateAssetsTool />
      <DeleteNodesTool />
      
      {/* Tool UIs (register render functions) */}
      <NodeListUI />
      <AssetDetailsUI />
      <CreateNodeUI />
      <UpdateNodesUI />
      <UpdateAssetsUI />
      <DeleteNodesUI />
      
      {children}
    </>
  );
}
```

---

## 集成到 ChatRuntimeProvider

```tsx
// src/features/chat/ChatRuntimeProvider.tsx
import { ChatToolsProvider } from './tools/ChatToolsProvider';

export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
  // ... existing runtime setup ...
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatToolsProvider>
        <CurrentThreadTracker>
          {children}
        </CurrentThreadTracker>
      </ChatToolsProvider>
    </AssistantRuntimeProvider>
  );
}
```

---

## 工具描述注入到模型

工具描述需要传递给 `ChatModelAdapter`，让 LLM 知道可用工具：

```typescript
// 在 getChatAdapter 或 ChatModelAdapter 中
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_nodes_list",
      description: "Get a list of all nodes on the canvas",
      parameters: { type: "object", properties: {} },
    },
  },
  // ... 其他工具定义
];
```

**注意**：assistant-ui 的 `makeAssistantTool` 会自动将工具描述注入到运行时。无需手动管理。

---

## 验证清单

- [ ] `get_nodes_list` 返回正确的节点列表
- [ ] `get_asset_details` 返回资产详情
- [ ] `create_node_smart` 成功创建节点并显示在画布
- [ ] `update_nodes` 成功更新节点数据
- [ ] `update_assets` 成功更新资产值
- [ ] `delete_nodes` 显示确认对话框
- [ ] 确认后节点被删除
- [ ] 取消后操作被中止
- [ ] 所有工具 UI 正确渲染

---

## 开始实现

1. 创建 `src/features/chat/tools/` 目录
2. 实现 6 个工具定义文件
3. 实现 6 个工具 UI 文件
4. 创建 `ChatToolsProvider.tsx`
5. 集成到 `ChatRuntimeProvider`
6. 测试工具调用
