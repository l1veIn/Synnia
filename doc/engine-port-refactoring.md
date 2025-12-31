# Engine Port 架构重构提案

## 背景

在实现 Edge Auto-Fill 功能时，发现当前 Port 系统职责不清晰，引擎层包含了过多节点特定逻辑。

## 当前问题

### 1. 数据位置不统一
- Recipe: `asset.value` 直接存储
- Selector: `asset.value.selected` 嵌套存储
- 旧代码: `asset.value.values`, `asset.content.values`

### 2. Port Resolver 职责过重
```typescript
// 当前: 引擎需要知道每种节点的数据结构
if (portValue.type === 'array') { /* Selector 特殊处理 */ }
if (content.values) { /* 旧格式特殊处理 */ }
```

### 3. 虚拟类型需要回退
- 节点类型 `recipe:naming-master`
- 端口注册在 `recipe`
- 需要手动添加回退逻辑

## 理想架构

```
Engine (通用)
  │ - 传递上下文 (sourceNode, targetNode, edge)
  │ - 调用节点 behavior 钩子
  │ - 管理连接生命周期
  ▼
Node Behavior (节点特定)
  │ - onConnect(edge, ctx) → 组装输入
  │ - getOutputValue(portId) → 暴露输出
  │ - onInputChange(fieldKey, value) → 响应变化
```

## 重构建议

### Phase 1: 扩展 NodeBehavior
```typescript
interface NodeBehavior {
  // 现有
  onValueChange?: ...
  
  // 新增
  onConnect?: (edge: Edge, ctx: ConnectionContext) => void;
  onDisconnect?: (edge: Edge) => void;
  resolveOutput?: (portId: string, asset: Asset) => PortValue;
}
```

### Phase 2: 简化 PortResolver
- 移除节点特定逻辑
- 只负责调用 `behavior.resolveOutput`
- 提供默认实现 fallback

### Phase 3: 统一数据存储
- 所有节点使用 `asset.value` 直接存储
- 配置存储在 `asset.config`

## 相关文件
- `src/core/engine/ports/PortResolver.ts`
- `src/core/engine/types/behavior.ts`
- `src/core/engine/InteractionSystem.ts`
