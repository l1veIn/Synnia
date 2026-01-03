# Form-Centric Node Architecture 迁移文档

> **Version**: 1.1  
> **Date**: 2026-01-03  
> **Status**: 待执行

---

## 1. 核心理念

> **一切数据皆 JSON，所有数据需要 Schema 描述**  
> **不考虑向后兼容，旧格式旧代码直接清理**

### 1.1 节点关系模型

```
单值节点 (valueType: record)     集合节点 (valueType: array)
┌─────────────────┐              ┌─────────────────┐
│   Form          │ ←───────────→│   Table         │
│   (动态 schema) │              │   (Form[])      │
└─────────────────┘              └─────────────────┘

┌─────────────────┐              ┌─────────────────┐
│   Image         │ ←───────────→│   Gallery       │
│   (固定 schema) │              │   (Image[])     │
└─────────────────┘              └─────────────────┘

┌─────────────────┐              ┌─────────────────┐
│   Text          │              │   Selector      │
│   (固定 schema) │              │   (Form[] + 选择)│
└─────────────────┘              └─────────────────┘
```

### 1.2 统一数据模型

```typescript
interface UnifiedAsset {
  id: string;
  valueType: 'record' | 'array';
  value: Record<string, any> | any[];
  sys: AssetSysMetadata;
  config: {
    schema: FieldDefinition[];   // 结构描述
    meta?: {                     // 派生元数据 (原 valueMeta)
      preview?: string;
      width?: number;
      height?: number;
      length?: number;
    };
    ...nodeSpecificConfig        // 节点特有配置
  };
}
```

> **变更点**: `valueMeta` 合并到 `config.meta`，简化顶层结构

---

## 2. 固定 Schema 规范

> **位置**: 固定 Schema 放在各节点文件夹下，靠近业务

### 2.1 文件组织

```
src/components/workflow/nodes/
├── TextNode/
│   ├── schema.ts          # TEXT_SCHEMA 定义
│   ├── definition.ts
│   ├── index.tsx
│   └── ...
├── ImageNode/
│   ├── schema.ts          # IMAGE_SCHEMA 定义
│   └── ...
├── GalleryNode/
│   ├── schema.ts          # GALLERY_ITEM_SCHEMA 定义
│   └── ...
```

### 2.2 TEXT_SCHEMA

```typescript
// TextNode/schema.ts
export const TEXT_SCHEMA: FieldDefinition[] = [
  { key: 'content', label: 'Content', type: 'string', widget: 'textarea' },
  { key: 'format', label: 'Format', type: 'string', widget: 'select',
    config: { options: ['plain', 'markdown', 'json'] } },
];
```

### 2.3 IMAGE_SCHEMA

```typescript
// ImageNode/schema.ts
export const IMAGE_SCHEMA: FieldDefinition[] = [
  { key: 'src', label: 'Source URL', type: 'string', widget: 'text' },
  { key: 'width', label: 'Width', type: 'number', widget: 'number' },
  { key: 'height', label: 'Height', type: 'number', widget: 'number' },
  { key: 'alt', label: 'Alt Text', type: 'string', widget: 'text' },
  { key: 'mimeType', label: 'MIME Type', type: 'string', widget: 'text' },
];
```

### 2.4 GALLERY_ITEM_SCHEMA

```typescript
// GalleryNode/schema.ts
import { IMAGE_SCHEMA } from '../ImageNode/schema';

export const GALLERY_ITEM_SCHEMA: FieldDefinition[] = [
  { key: 'id', label: 'ID', type: 'string' },
  ...IMAGE_SCHEMA,
  { key: 'starred', label: 'Starred', type: 'boolean', widget: 'switch' },
  { key: 'caption', label: 'Caption', type: 'string', widget: 'text' },
  { key: 'mediaAssetId', label: 'Media Asset ID', type: 'string' },
];
```

---

## 3. 引擎适配

### 3.1 AssetSystem 变更

| 方法 | 变更 |
|------|------|
| `create(valueType, value, options)` | 移除 `valueMeta` 参数，改为 `config.meta` |
| `createFromPartial()` | 同上 |
| 新增 `updateMeta(id, meta)` | 更新 `config.meta` |

### 3.2 代码变更示例

```typescript
// AssetSystem.ts
public create(
  valueType: ValueType,
  value: any,
  options: {
    name?: string;
    config?: {
      schema?: FieldDefinition[];
      meta?: Record<string, any>;
      [key: string]: any;
    };
    source?: 'user' | 'ai' | 'import';
  } = {}
): string {
  // ...
}
```

---

## 4. 清理规范

| 清理项 | 处理方式 |
|--------|----------|
| `valueType: 'text' \| 'image'` | 移除 |
| `TextAsset` / `ImageAsset` | 移除 |
| `valueMeta` 顶层字段 | 移到 `config.meta` |
| 旧数据兼容层 | 不需要 |
| Rust 后端 | 同步更新 |

---

## 5. 涉及文件

### 5.1 新增

| 文件 | 内容 |
|------|------|
| `TextNode/schema.ts` | TEXT_SCHEMA |
| `ImageNode/schema.ts` | IMAGE_SCHEMA |
| `GalleryNode/schema.ts` | GALLERY_ITEM_SCHEMA |

### 5.2 修改 - 类型与引擎

| 文件 | 变更 |
|------|------|
| `src/types/assets.ts` | 移除 TextAsset/ImageAsset，valueMeta→config.meta |
| `src/core/registry/NodeRegistry.ts` | 添加 `fixedSchema?` |
| `src/core/engine/AssetSystem.ts` | 适配 config.meta |

### 5.3 修改 - 节点

| 节点 | 文件 |
|------|------|
| TextNode | definition.ts, index.tsx, Inspector.tsx, behavior.ts |
| ImageNode | definition.ts, index.tsx, Inspector.tsx, behavior.ts |
| GalleryNode | definition.ts, index.tsx |

### 5.4 后端

| 文件 | 变更 |
|------|------|
| `src-tauri/src/models/asset.rs` | 移除 text/image，valueMeta→config.meta |

---

## 6. 里程碑

### M1: 基础设施
- [ ] 扩展 `NodeDefinition.fixedSchema`
- [ ] 创建各节点 `schema.ts`

### M2: 类型重构
- [ ] 移除 `TextAsset` / `ImageAsset`
- [ ] `valueMeta` → `config.meta`

### M3: 引擎适配
- [ ] `AssetSystem.ts` 适配
- [ ] `createFromPartial()` 适配

### M4: 节点迁移
- [ ] TextNode
- [ ] ImageNode
- [ ] GalleryNode

### M5: 后端同步
- [ ] Rust asset model

### M6: 清理
- [ ] 移除废弃代码
- [ ] TypeScript 检查

---

## 7. 验收标准

- [ ] 所有节点 `valueType: 'record' | 'array'`
- [ ] 所有节点有 `config.schema`
- [ ] `valueMeta` 完全移除，改用 `config.meta`
- [ ] 固定 Schema 在节点文件夹内
- [ ] TypeScript 0 errors
- [ ] 前后端联调正常
