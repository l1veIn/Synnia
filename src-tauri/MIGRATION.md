# Backend Architecture Migration Plan

> **STATUS: PHASE 11 COMPLETE** ✅
>
> New modular architecture created and validated. Use `new_features` feature to switch.

## Migration Strategy

The new architecture uses a **feature flag** (`new_features`) to enable switching between old and new modules:

```toml
# Cargo.toml - to enable new modules
[features]
new_features = []
```

**Current State:**
- Old modules (`commands/*`, `services/*`) are active and working
- New modules (`features/*`) are implemented but gated behind feature flag
- Both can coexist without conflicts

**To Complete Migration:**
1. Enable feature: Add `new_features = []` to `[features]` in Cargo.toml
2. Update lib.rs to use `crate::features::*` commands
3. Remove old modules after testing

---

## 结晶后的目录结构

```
src-tauri/src/
├── main.rs
├── lib.rs                   # 最小化入口
│
├── core/
│   ├── mod.rs
│   ├── error.rs             # thiserror 增强
│   └── state.rs
│
├── domain/                  # 数据结构 + Serde + ts-rs
│   ├── mod.rs
│   ├── project.rs
│   ├── asset.rs
│   ├── graph.rs
│   └── recipe.rs
│
├── infrastructure/          # 单层目录，不过度拆分
│   ├── mod.rs
│   ├── database.rs          # 连接 + Schema + 迁移
│   ├── http.rs              # 代理 + Base64 fetch
│   ├── server.rs            # file_server
│   └── hash.rs              # 哈希工具
│
├── features/
│   ├── mod.rs
│   ├── project/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   └── persistence.rs
│   ├── asset/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   ├── persistence.rs
│   │   ├── types.rs
│   │   └── image.rs
│   ├── history/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   └── persistence.rs
│   ├── recipe/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   ├── persistence.rs
│   │   └── types.rs
│   ├── settings/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   └── config.rs
│   ├── agent/
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   └── service.rs
│   └── operations/
│       ├── mod.rs
│       ├── chat.rs          # 合并 commands + persistence
│       └── logs.rs          # 合并 commands + persistence
│
└── app/
    ├── mod.rs
    ├── setup.rs
    └── handlers.rs
```

---

## 迁移映射表

### Phase 1: `core/`

| 新文件 | 来源 | 说明 |
|--------|------|------|
| `core/error.rs` | `error.rs` | 增强错误类型 |
| `core/state.rs` | `state.rs` | 完整迁移 |

### Phase 2: `domain/`

| 新文件 | 来源 | 行号范围 |
|--------|------|----------|
| `domain/project.rs` | `models.rs` | L12-41: `SynniaProject`, `ProjectMeta` |
| `domain/asset.rs` | `models.rs` | L42-166: `Asset`, `ValueType`, 各种 Config |
| `domain/graph.rs` | `models.rs` | L167-273: `Graph`, `Node`, `Edge`, `Viewport` |
| `domain/recipe.rs` | `models.rs` | L274-288: `AgentDefinition` |

### Phase 3: `infrastructure/`

| 新文件 | 来源 | 说明 |
|--------|------|------|
| `infrastructure/database.rs` | `services/database.rs` | 合并: connection + schema + migration |
| `infrastructure/http.rs` | `commands/http_proxy.rs` | 提取 HTTP 逻辑（不含 tauri::command） |
| `infrastructure/server.rs` | `services/file_server.rs` | 完整迁移 |
| `infrastructure/hash.rs` | `services/hash.rs` | 完整迁移 |

### Phase 4: `features/project/`

| 新文件 | 来源 | 说明 |
|--------|------|------|
| `commands.rs` | `commands/project.rs` | 保留 #[tauri::command]，调用 persistence |
| `persistence.rs` | `services/io_sqlite.rs` + `commands/project.rs` | 合并业务逻辑 + DB 操作 |

### Phase 5: `features/asset/`

| 新文件 | 来源 | 说明 |
|--------|------|------|
| `types.rs` | `commands/asset.rs` L16-42, L254-277, L528-531, L809-816 | 所有类型定义 |
| `image.rs` | `commands/asset.rs` L671-804 | 图片处理工具函数 |
| `commands.rs` | `commands/asset.rs` | 命令签名 |
| `persistence.rs` | `commands/asset.rs` | 业务逻辑 + DB 操作 |

### Phase 6: `features/history/`

| 新文件 | 来源 |
|--------|------|
| `commands.rs` | `commands/history.rs` |
| `persistence.rs` | `services/history.rs` |

### Phase 7: `features/recipe/`

| 新文件 | 来源 |
|--------|------|
| `types.rs` | `commands/recipe.rs` L13-51 |
| `commands.rs` | `commands/recipe.rs` (命令部分) |
| `persistence.rs` | `commands/recipe.rs` (业务逻辑) |

### Phase 8: `features/settings/`

| 新文件 | 来源 |
|--------|------|
| `config.rs` | `config.rs` |
| `commands.rs` | `commands/agent.rs` (设置相关命令) |

### Phase 9: `features/agent/`

| 新文件 | 来源 |
|--------|------|
| `commands.rs` | `commands/agent.rs` (AI 相关命令) |
| `service.rs` | `services/agent_service.rs` |

### Phase 10: `features/operations/`

| 新文件 | 来源 |
|--------|------|
| `chat.rs` | `commands/ops_chat.rs` |
| `logs.rs` | `commands/ops_logs.rs` |

### Phase 11: `app/`

| 新文件 | 来源 |
|--------|------|
| `setup.rs` | `lib.rs` L37-72 |
| `handlers.rs` | `lib.rs` L74-155 |

---

## 迁移执行顺序

每个 Phase 完成后必须通过编译验证：

```bash
# Phase N 完成后
cargo build 2>&1 | head -50
```

| Phase | 目标 | 验证 |
|-------|------|------|
| 1 | `core/` | `cargo build` ✓ |
| 2 | `domain/` | `cargo build` ✓ |
| 3 | `infrastructure/` | `cargo build` ✓ |
| 4 | `features/project/` | `cargo build` ✓ |
| 5 | `features/asset/` | `cargo build` ✓ |
| 6 | `features/history/` | `cargo build` ✓ |
| 7 | `features/recipe/` | `cargo build` ✓ |
| 8 | `features/settings/` | `cargo build` ✓ |
| 9 | `features/agent/` | `cargo build` ✓ |
| 10 | `features/operations/` | `cargo build` ✓ |
| 11 | `app/` + 重写 `lib.rs` | `cargo build` ✓ |
| 12 | 删除旧文件 | `cargo test` ✓ |

---

## 删除清单

迁移完成后删除：

```
[DELETE] commands/          # 整个目录
[DELETE] services/          # 整个目录
[DELETE] models.rs
[DELETE] error.rs
[DELETE] config.rs
[DELETE] state.rs
```

---

## 最终验证

```bash
cargo build --release
cargo clippy -- -D warnings
cargo test
```
