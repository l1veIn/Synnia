# TEP 结晶：配方系统架构

> **Date:** 2024-12-26  
> **Status:** CRYSTALIZED  
> **Method:** TEP v2.0 (Truth Engine Protocol)

---

## 核心定义

**配方 = 将「非结构化 AI 调用」封装为「结构化表单交互」**

```
配方节点 = 表单 + 模型选择 + 系统提示词 + 用户提示词模板 + 输出定义 + 对话上下文
```

---

## 关键决策

| 议题 | 决策 |
|------|------|
| RecipeNode 是否保留 | ✅ 保留，有独立存在价值 |
| RecipeNode vs FormNode | 不同概念：Form = 数据容器，Recipe = AI 生成任务容器 |
| 多轮迭代 | ✅ 内置 Chat Context，支持「名字再长点」类追加指令 |
| Transform 类配方 | 暂存，template/http/expression 后续单独讨论 |

---

## Inspector Tab 结构

```
[Props] [History] [Debug]               ← 所有节点共用
        │
        └── 配方节点专属 ───┬── [表单]       纯业务输入
                           ├── [模型]       模型选择 + 参数
                           ├── [对话记录]   Chat Context + 追加指令输入框
                           └── [高级]       渐进式暴露（编辑 Prompt）
```

---

## 配方资产结构

配方节点使用 `RecordAsset`，通过 `config` 扩展存储配方特有数据：

```typescript
// 现有 RecordAsset 结构
interface RecordAsset extends BaseAsset {
  valueType: 'record';
  value: Record<string, any>;        // 表单数据 (formValues)
  valueMeta: RecordAssetValueMeta;
  config: RecordAssetConfig;
  sys: AssetSysMetadata;
}

// 配方节点使用的 config 扩展
interface RecipeAssetConfig extends RecordAssetConfig {
  schema: FieldDefinition[];         // 表单 schema
  recipeId: string;                  // 配方 ID
  
  // 新增：模型配置
  modelConfig?: {
    modelId: string;
    provider?: string;
    config: Record<string, any>;     // temperature, maxTokens, etc.
  };
  
  // 新增：对话上下文
  chatContext?: {
    messages: ChatMessage[];
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  outputAssetId?: string;            // assistant 消息引用输出资产
  imageAssetId?: string;             // 图片引用
  timestamp: number;
}
```

### 设计说明

| 字段 | 存放位置 | 说明 |
|------|----------|------|
| 表单数据 | `value` | 用户填写的业务数据 |
| 表单 Schema | `config.schema` | 现有字段 |
| 配方 ID | `config.recipeId` | 标识使用哪个配方 |
| 模型配置 | `config.modelConfig` | 新增 |
| 对话历史 | `config.chatContext` | 新增 |

---

## 模型驱动的能力声明

配方节点的行为由 **模型的 capabilities 决定**，不是 executor 类型决定：

```typescript
// src/features/models/types.ts
export type ModelCapability =
    | 'chat'           // 支持多轮对话 → 启用 ChatContext
    | 'vision'         // 支持图片输入 → 添加图片 Handle
    | 'json-mode'      // 支持结构化输出
    | 'function-calling'
    | 'streaming';
```

### 运行时逻辑

```typescript
const model = getModel(modelConfig.modelId);

// ChatContext 是否启用？
if (model.capabilities?.includes('chat')) {
  // 启用多轮对话，维护 ChatContext
  chatContextEnabled = true;
}

// 动态 Handle 添加？
if (model.capabilities?.includes('vision')) {
  // 添加参考图片输入 Handle
  addHandle('referenceImage', { dataType: 'image' });
}
```

### 设计优势

| 模型类型 | capabilities | 行为 |
|----------|--------------|------|
| GPT-4o | `['chat', 'vision', 'json-mode']` | 多轮对话 ✅ + 图片输入 ✅ |
| DALL-E 3 | `[]` 或 `['vision']` | 无对话，单次生成 |
| Fal Nano Banana | `['chat', 'vision']` | 多轮对话 ✅ + 图片输入 ✅ |
| Sora | `['chat']` | 多轮对话 ✅ |

**同一个 RecipeNode，不同模型有不同交互能力。**

---

## 动态 Handle 机制

- **原则**：模型决定输入需求，而非配方声明
- **实现**：模型 Tab 检测 `capabilities` → 动态添加 Handle
- **示例**：选择 Vision 模型 → 自动出现「参考图片」端口

```
模型声明 capabilities: ['vision']
         ↓
模型 Tab 检测到
         ↓
节点底部自动添加 📷 Reference Image 端口
         ↓
用户可从 ImageNode 拖线连接
```

---

## 图像模型多轮处理

```typescript
if (model.category === 'image-generation' && model.capabilities.includes('image-input')) {
  // 自动传入对话上下文里最近的一张图
  const lastImage = chatContext.messages.findLast(m => m.imageAssetId);
  input.referenceImage = lastImage?.imageAssetId;
}
```

---

## 输出策略差异

| 配方类型 | 输出节点 | 迭代行为 |
|----------|----------|----------|
| **LLM 类** | Selector/Table/Text | **Update**：替换现有内容 |
| **图像类** | Gallery | **Push**：新图追加到 Gallery |

### 图像多轮「选择基准图」（仅 chat 能力模型）

在配方节点的「对话记录」Tab 输入框支持 @ 引用图片：

```
┌─────────────────────────────────────────────────────────┐
│ 对话记录 Tab                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ � + @ 输入追加指令...              [发送]         │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

点击 📷 或输入 @ 可选择图片：
├── Handle 连接的图片
├── 对话历史中的图片
└── 项目图片资产
```

**注意**：仅当模型 `capabilities.includes('chat')` 时才显示。

---

## 用户交互简化

| 操作 | 方式 |
|------|------|
| 迭代优化 | 在「对话记录」Tab 底部输入追加指令 |
| 从头开始 | 创建新的配方节点 |
| 版本回退 | 使用节点自带的 History 机制 |

---

## 红蓝验证微调

| 原结论 | 验证结果 | 微调 |
|--------|----------|------|
| RecipeNode 独立存在 | ✅ | ChatContext 的 assistant 消息存 `outputAssetId` 引用 |
| 4 Tab 结构 | ✅ | 无 |
| 动态 Handle | ✅ | 模型切换导致边断开时需 Toast 提示 |
| 图像多轮 | ⚠️ | 在配方节点对话输入框支持 @ 选择基准图 |

---

## 代码影响评估

### 🔴 高影响（需重构）

| 文件/目录 | 影响 | 工作量 |
|-----------|------|--------|
| `RecipeNode/Inspector.tsx` | 重构为 4 Tab 结构（表单/模型/对话记录/高级） | ⭐⭐⭐ |
| `RecipeNode/index.tsx` | 添加 ChatContext 渲染、动态 Handle 支持 | ⭐⭐⭐ |
| `useRunRecipe.ts` | 支持迭代模式、更新 ChatContext | ⭐⭐⭐ |
| `types/assets.ts` | RecipeAsset 添加 `chatContext` 字段 | ⭐⭐ |

### 🟡 中影响（需修改）

| 文件/目录 | 影响 | 工作量 |
|-----------|------|--------|
| `ModelConfigurator.tsx` | 从 Widget 提取为独立 Tab 组件 | ⭐⭐ |
| `executors/impl/llm-agent.ts` | 支持 ChatContext 消息数组 | ⭐⭐ |
| `executors/impl/media.ts` | 支持基准图选择 | ⭐⭐ |

### 🟢 低影响（小改动）

| 文件/目录 | 影响 | 工作量 |
|-----------|------|--------|
| `features/recipes/*.yaml` | 无需改动 | - |
| `NodeRegistry.ts` | 无需改动 | - |
| `GraphEngine.ts` | 可能需添加边断开提示 | ⭐ |

### ⏸️ 暂存（Transform 类）

| 文件 | 状态 |
|------|------|
| `executors/impl/template.ts` | 暂不处理 |
| `executors/impl/http.ts` | 暂不处理 |
| `executors/impl/expression.ts` | 暂不处理 |
