# Synnia 节点类型扩展设计文档

## 设计理念

> **节点类型 ← 交互模式 ← 人与数据的关系**

Synnia 作为资产管理器，节点类型的扩展应该从**常见的数据交互范式**中寻找灵感。每种节点对应一种核心交互模式，而不是通用的"万能节点"。

---

## 节点分类

| 分类 | 节点 | 定位 | 输入端口 | 数据来源 |
|------|------|------|----------|----------|
| **边缘节点** | Text / Image | 原子数据容器 | ❌ 无 | 用户编辑 |
| **集合节点** | Selector / Table / Gallery | 集合数据容器（重编辑） | ❌ 无 | 用户交互 / 预置数据 |
| **配方节点** | Recipe | 执行单元 | ✅ 有 | 上游节点 + 用户输入 |

> **关键设计决策**：集合节点定位为**重编辑**，不是**重组织**。数据来自用户交互，不从上游拉取。如需聚合多个节点的数据，应通过配方节点实现。

---

## Handle 规范

### 问题背景

当前 handle 分散在各节点中管理，命名不统一，语义混乱。需要建立统一规范。

### Handle 语义分类

| 语义 | ID 模式 | 用途 |
|------|---------|------|
| **DATA_OUT** | `text-out`, `image-out`, `json-out` | 节点输出数据 |
| **DATA_IN** | `field:xxx` | 配方接收数据 |
| **PRODUCT** | `product` | 配方产出结果 |
| **ORIGIN** | `origin` | 被生成节点的来源标记 |

### Handle 数据类型

| 类型 | 说明 |
|------|------|
| `text` | 文本字符串 |
| `image` | 图片 (URL / base64) |
| `json` | 结构化对象 |
| `array` | 数组 |
| `any` | 任意类型 |

### 各节点标准 Handle

| 节点 | Handle ID | 位置 | 方向 | 语义 | 数据类型 |
|------|-----------|------|------|------|----------|
| **Text** | `text-out` | Bottom | source | DATA_OUT | text |
| **Image** | `image-out` | Bottom | source | DATA_OUT | image |
| **JSON** | `json-out` | Right | source | DATA_OUT | json |
| **Selector** | `selected` | Bottom | source | DATA_OUT | array |
| **Selector** | `single` | Right | source | DATA_OUT | json |
| **Table** | `rows` | Bottom | source | DATA_OUT | array |
| **Gallery** | `images` | Bottom | source | DATA_OUT | array |
| **Gallery** | `starred` | Right | source | DATA_OUT | array |
| **Recipe** | `field:xxx` | Left | target | DATA_IN | any |
| **Recipe** | `product` | Bottom | source | PRODUCT | any |
| **Recipe** | `response` | Right | source | DATA_OUT | text |
| **Generated** | `origin` | Top | target | ORIGIN | - |

### TypeScript 定义

```typescript
// src/types/handles.ts

export enum HandleSemantic {
  DATA_IN = 'data-in',
  DATA_OUT = 'data-out',
  ORIGIN = 'origin',
  PRODUCT = 'product',
}

export enum HandleDataType {
  TEXT = 'text',
  IMAGE = 'image',
  JSON = 'json',
  ARRAY = 'array',
  ANY = 'any',
}

export interface HandleDefinition {
  id: string;
  semantic: HandleSemantic;
  dataType: HandleDataType;
  position: 'top' | 'bottom' | 'left' | 'right';
  direction: 'source' | 'target';
}
```

---

## 现有节点

| 节点 | 数据类型 | 交互模式 |
|------|----------|----------|
| Text Node | 文本 | 输入/展示 |
| Image Node | 图片 | 展示/预览 |
| JSON Node | 结构化对象 | 字段编辑 |
| Recipe Node | 配方执行 | 配置/执行 |

---

## 新增集合类型节点

### 1. Selector Node (选择器节点)

**核心交互**: 选择、筛选、查询

**使用场景**:
- 从资产定义库中选择要生成的资产类型
- 从风格模板库中选择视觉风格
- 从命名结果中选择最终名字

**UI 设计**:
```
┌──────────────────────────────────┐
│  📋 资产定义库           🔍 搜索  │
├──────────────────────────────────┤
│  ☑️ character-main    [主视觉]   │
│  ☑️ ui-kit-core       [核心UI]   │
│  ☐ sticker-pack      [表情包]   │
│  ☐ marketing-poster  [海报]     │
│  ☑️ expression-sheet  [表情差分] │
│                                  │
│  已选: 3/20          [全选] [清空]│
├──────────────────────────────────┤
│  [+ 添加自定义项]                 │
└──────────────────○───────────────┘
                   ↓
              selected[]
```

**输入/输出**:
| Port | 方向 | 类型 | 说明 |
|------|------|------|------|
| items | 输入 | Array | 可选项列表（可选，支持预设） |
| selected | 输出 | Array | 用户选中的项目 |
| single | 输出 | Object | 单选模式下选中的单个项目 |

**配置项**:
- `mode`: 单选 / 多选
- `searchable`: 是否支持搜索
- `allowCustom`: 是否允许添加自定义项
- `presetData`: 预置数据（如内置资产定义）

**实现优先级**: ⭐⭐⭐⭐⭐ (最高)

---

### 2. Table Node (表格节点)

**核心交互**: 增删改查、排序、批量编辑

**使用场景**:
- 编辑 JSON 数组数据
- 配置多个资产的参数
- 管理键值对映射

**UI 设计**:
```
┌─────────────────────────────────────────────┐
│  📊 资产配置表                    [+行] [列▼] │
├──────┬──────────────┬───────────┬───────────┤
│  ID  │     类型     │   标签    │  分辨率   │
├──────┼──────────────┼───────────┼───────────┤
│  1   │ ui-kit-core  │ 核心UI   │    4K     │
│  2   │ sticker-pack │ 表情包   │    4K     │
│  3   │ poster       │ 海报     │    1K     │
├──────┴──────────────┴───────────┴───────────┤
│  3 行 · [导出 JSON]                          │
└───○─────────────────────────────────────○───┘
    ↓                                     ↓
  rows[]                              schema
```

**输入/输出**:
| Port | 方向 | 类型 | 说明 |
|------|------|------|------|
| data | 输入 | Array | 初始数据（可选） |
| schema | 输入 | Schema | 列定义（可选） |
| rows | 输出 | Array | 所有行数据 |
| selected | 输出 | Array | 选中的行 |

**配置项**:
- `columns`: 列定义（key, label, type, editable）
- `sortable`: 是否可排序
- `selectable`: 是否可选择行
- `addable`: 是否可添加新行

**实现优先级**: ⭐⭐⭐⭐ (高)

---

### 3. Gallery Node (相册节点)

**核心交互**: 预览、浏览、收藏、管理

**使用场景**:
- 展示 AI 生成的图片结果
- 管理参考图片库
- 收藏和筛选最佳结果

**UI 设计**:
```
┌────────────────────────────────────────┐
│  🖼️ 生成结果                    [网格▼] │
├────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 📷  │ │ 📷  │ │ 📷  │ │ 📷  │      │
│  │ ⭐  │ │     │ │ ⭐  │ │     │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
│  已选: 2张  [导出] [删除选中]            │
└───○────────────────────────────○───────┘
    ↓                            ↓
  all[]                      starred[]
```

**输入/输出**:
| Port | 方向 | 类型 | 说明 |
|------|------|------|------|
| images | 输入 | Array | 图片数据数组 |
| all | 输出 | Array | 所有图片 |
| starred | 输出 | Array | 标星收藏的图片 |
| selected | 输出 | Array | 当前选中的图片 |

**配置项**:
- `viewMode`: 网格 / 列表 / 大图
- `columns`: 每行显示数量
- `allowDelete`: 是否可删除
- `allowReorder`: 是否可拖拽排序

**实现优先级**: ⭐⭐⭐⭐ (高)

---

### 4. Queue Node (队列节点)

**核心交互**: 排序、执行、监控进度

**使用场景**:
- 批量执行多个配方
- 管理生成任务队列
- 监控异步任务进度

**UI 设计**:
```
┌────────────────────────────────────────┐
│  📋 生成队列                    [▶ 开始] │
├────────────────────────────────────────┤
│  1. ✅ 主视觉生成          完成          │
│  2. 🔄 UI Kit 生成        进行中...     │
│  3. ⏳ 表情包生成          等待中        │
│  4. ⏳ 海报生成            等待中        │
├────────────────────────────────────────┤
│  进度: 1/4  [暂停] [清空]               │
└───○────────────────────────────○───────┘
    ↓                            ↓
  tasks[]                    results[]
```

**输入/输出**:
| Port | 方向 | 类型 | 说明 |
|------|------|------|------|
| tasks | 输入 | Array | 任务列表 |
| recipe | 输入 | Recipe | 要执行的配方（可选） |
| results | 输出 | Array | 执行结果 |
| current | 输出 | Object | 当前任务 |

**配置项**:
- `autoStart`: 是否自动开始
- `concurrency`: 并发数
- `retryOnError`: 失败是否重试

**实现优先级**: ⭐⭐⭐ (中)

---

## 数据流架构

### 核心原则：Pull-Based (拉取式)

Synnia 采用**拉取式数据流**，只有配方节点执行时才会触发数据流动：

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Text   │    │  JSON   │    │ Selector│   ← 被动数据源
│  Node   │    │  Node   │    │  Node   │     (只提供输出)
└────○────┘    └────○────┘    └────○────┘
     │              │              │
     └──────────────┼──────────────┘
                    ↓
            ┌──────────────┐
            │ Recipe Node  │   ← 主动消费者
            │   [▶ 执行]   │     (触发数据流)
            └──────────────┘
```

### 节点分类

| 类型 | 输入端口 | 输出端口 | 数据来源 |
|------|----------|----------|----------|
| **数据节点** (Text/Image/JSON) | ❌ 无 | ✅ 有 | 用户编辑 / asset.content |
| **集合节点** (Selector/Table/Gallery) | ❌ 无 | ✅ 有 | 用户交互 / 预置数据 |
| **配方节点** (Recipe) | ✅ 有 | ✅ 有 | 上游节点 + 用户输入 |

> **重要**：集合节点是纯粹的数据源，没有输入端口。数据来自用户交互（勾选、编辑）或预置数据。

---

## Edge 类型扩展

### 问题背景

配方执行后可能**生成新节点**（如 Text、Image），需要用连线表示"产出关系"。但这与"数据流"的语义不同：

| 类型 | 语义 | 方向 |
|------|------|------|
| **数据流** | "我要读取你的数据" | 数据源 → 配方 |
| **产出关系** | "我生成了你" | 配方 → 生成的节点 |

### 解决方案：区分连线类型

#### 1. Data Edge (数据连线)

**用途**: 配方读取上游节点的数据

**视觉**: 实线 + 箭头

```
○───────────────────▶○
```

**属性**:
- `type: 'data'`
- 用户手动创建
- 执行时沿此线拉取数据

#### 2. Output Edge (产出连线)

**用途**: 配方生成的子节点关联

**视觉**: 虚线 + 不同颜色

```
○ ─ ─ ─ ─ ─ ─ ─ ─ ▷ ○
```

**属性**:
- `type: 'output'`
- 配方执行后自动创建
- 表示"这是我的产物"
- 样式: `{ strokeDasharray: '5 5', stroke: '#a855f7' }`

### 视觉对比

```
       实线 = 数据输入 (蓝色)
           ↓
 ┌─────────○─────────┐
 │   Selector Node   │
 └─────────○─────────┘
           │
           ▼ 实线
 ┌─────────○─────────┐
 │   Recipe Node     │
 │     [▶ 执行]      │
 └─────────◇─────────┘
           ┊
           ┊ 虚线 = 产出关系 (紫色)
           ▽
 ┌─────────◇─────────┐
 │  Generated Text   │
 └───────────────────┘
```

### 实现建议

```typescript
// Edge 类型定义
type SynniaEdgeType = 'data' | 'output';

interface SynniaEdge extends Edge {
  type: SynniaEdgeType;
}

// 创建产出连线
const createOutputEdge = (sourceId: string, targetId: string): SynniaEdge => ({
  id: `output-${sourceId}-${targetId}`,
  source: sourceId,
  sourceHandle: 'product',
  target: targetId,
  targetHandle: 'origin',  // 新的 handle 专用于产出关系
  type: 'output',
  animated: true,
  style: { 
    strokeDasharray: '5 5',
    stroke: '#a855f7'  // 紫色
  }
});
```

---

## 扩展方向（未来考虑）

| 节点类型 | 交互模式 | 应用场景 |
|----------|----------|----------|
| Tree Node | 展开、折叠、层级 | 嵌套结构、分类管理 |
| Timeline Node | 顺序、历史 | 版本历史、操作记录 |
| Canvas Node | 自由画布 | 图片标注、布局设计 |
| Diff Node | 对比、合并 | 版本对比、选择最优 |

---

## 实现建议

### 优先级排序

1. **Selector Node** — 当前最急需，用于资产选择
2. **Gallery Node** — 展示生成结果必需
3. **Table Node** — 批量数据编辑很实用
4. **Queue Node** — 批量执行，可后续实现

### 架构统一

所有集合节点应遵循统一模式：
- 继承 `NodeShell` 和 `NodeHeader`
- 使用 `useNode` hook
- 定义 `outputs` resolver（只有输出，没有输入）
- 提供 `Inspector` 组件

### 与工作流模板的配合

集合节点是**工作流模板**的核心组成部分：
- 工作流 = N 个配方节点 + M 个集合节点
- 集合节点自带预置数据（如资产定义列表）
- 用户可在集合节点中增删改数据
