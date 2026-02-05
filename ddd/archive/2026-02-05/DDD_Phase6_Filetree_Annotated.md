# Phase 6 具体目录标注版文件树（当前结构 + 角色 + 去向）

```
src/
  domain/                     # 领域层（权威）
  application/                # 用例层（权威）
  infrastructure/             # 基础设施（权威）

  components/                 # UI 组件（保留）
  pages/                      # 页面（保留）
  hooks/                      # UI hooks（瘦身）

  core/engine/                # 旧引擎（退役/瘦身）
  features/                   # legacy 功能组（迁移中）
  lib/                        # 工具层（迁移中）
  types/                      # legacy types（逐步迁移到 domain）
  store/                      # Zustand store（投影层）
```

## 标注规则
- 权威层：domain/application/infrastructure
- 迁移中：core/engine, features, lib, types
- 投影层：store
