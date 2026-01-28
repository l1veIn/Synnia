# Synnia Test Coverage PRD

## Overview

为 Synnia 项目添加全面的单元测试覆盖，使用 Ralph 模式自动化测试生成。

### Goals

- **覆盖率目标**: 60% line coverage
- **测试框架**: Vitest
- **Mock 策略**: 完全 mock Tauri API 和所有外部 API 调用

### Constraints

- 测试文件放在对应源文件旁边的 `__tests__/` 目录
- 测试文件命名: `xxx.test.ts` 或 `xxx.test.tsx`
- 使用 Vitest 的 `describe/it/expect` 语法
- Mock 所有外部依赖（Tauri、fetch、Provider API）
- 每个函数至少测试正常路径和错误路径
- 不测试 `src/components/ui/` 目录（shadcn 组件）
- 不测试纯类型定义文件

---

## Phase 1: Infrastructure Setup ✅

基础设施搭建，为后续测试做准备。

- [x] 创建 `src/__mocks__/@tauri-apps/api.ts` - Tauri core API mock
- [x] 创建 `src/__mocks__/@tauri-apps/plugin-fs.ts` - 文件系统 mock
- [x] 创建 `src/__mocks__/@tauri-apps/plugin-dialog.ts` - 对话框 mock
- [x] 创建 `src/__mocks__/@tauri-apps/plugin-shell.ts` - Shell mock
- [x] 更新 `vitest.config.ts` 配置 setupFiles 和 mock 路径
- [x] 创建 `src/test/setup.ts` - 全局测试配置
- [x] 创建 `src/test/utils.tsx` - 测试工具函数（renderWithProviders 等）
- [x] 安装 `@testing-library/react` `@testing-library/dom` `jsdom`
- [x] 创建 `.ralphy/config.yaml` - Ralph 配置

---

## Phase 2: Core Executors (Priority: Critical)

执行器是 Recipe 执行的核心，必须优先测试。

### HTTP Executor
- [x] `src/features/executors/http/__tests__/HttpExecutor.test.ts`
  - 测试 `canHandle()` 正确识别 http 类型
  - 测试 `execute()` 成功发送 GET 请求
  - 测试 `execute()` 成功发送 POST 请求
  - 测试模板变量插值 `{{input.xxx}}`
  - 测试 headers 插值
  - 测试 body 插值（string 和 object）
  - 测试 HTTP 错误处理（4xx, 5xx）
  - 测试网络错误处理
  - 测试缺少 url 配置时的错误

### Agent Executor
- [ ] `src/features/executors/agent/__tests__/AgentExecutor.test.ts`
  - 测试 `canHandle()` 正确识别 agent 类型
  - 测试 `execute()` 调用 model 并返回结果
  - 测试 prompt 模板渲染
  - 测试 streaming 回调
  - 测试错误处理
  - 测试取消执行

### Output Strategy
- [ ] `src/features/executors/utils/__tests__/outputStrategy.test.ts`
  - 测试各种 output type 的处理
  - 测试 JSON 解析策略
  - 测试 image URL 提取
  - 测试 text 提取

---

## Phase 3: Recipe System (Priority: Critical)

Recipe 加载和 prompt 处理。

### Prompt Utils
- [ ] `src/features/recipes/__tests__/promptUtils.test.ts`
  - 测试 `interpolate()` 基本替换
  - 测试嵌套对象路径 `{{input.user.name}}`
  - 测试未定义变量处理
  - 测试特殊字符转义
  - 测试数组值处理

### Recipe Loader
- [ ] `src/features/recipes/__tests__/recipeLoader.test.ts`
  - 测试 YAML manifest 解析
  - 测试 schema 兼容性转换
  - 测试无效 manifest 错误处理
  - 测试文件路径解析

### Schema Compat
- [ ] `src/features/recipes/utils/__tests__/schemaCompat.test.ts`
  - 测试旧版 schema 格式转换
  - 测试新版 schema 直接返回

---

## Phase 4: Core Engine (Priority: High)

引擎核心逻辑。

### Asset System
- [ ] `src/core/engine/__tests__/AssetSystem.test.ts`
  - 测试 asset 创建
  - 测试 asset 更新
  - 测试 asset 类型判断
  - 测试 asset 值提取

### Field Capability
- [ ] `src/core/engine/__tests__/FieldCapability.test.ts`
  - 测试字段类型兼容性检查
  - 测试字段值验证
  - 测试默认值处理

### Port Types
- [ ] `src/core/engine/ports/__tests__/types.test.ts` (已存在，检查覆盖)
  - 确保现有测试覆盖完整

### Edge Validator
- [ ] `src/core/engine/ports/__tests__/EdgeValidator.test.ts`
  - 测试连接合法性验证
  - 测试类型匹配规则

### Smart Resolve
- [ ] `src/core/engine/__tests__/smartResolve.test.ts`
  - 测试自动解析逻辑

---

## Phase 5: Node Behaviors (Priority: High)

各节点的执行行为逻辑。

### Recipe Node
- [ ] `src/components/workflow/nodes/RecipeNode/__tests__/behavior.test.ts`
  - 测试 `buildInputs()` 从连接获取输入
  - 测试 `execute()` 调用 executor
  - 测试输出处理
  - 测试错误状态

### Form Node
- [ ] `src/components/workflow/nodes/FormNode/__tests__/behavior.test.ts`
  - 测试表单值收集
  - 测试 schema 解析
  - 测试默认值处理

### Image Node
- [ ] `src/components/workflow/nodes/ImageNode/__tests__/behavior.test.ts`
  - 测试图片 asset 处理
  - 测试 URL 和 base64 转换

### Text Node
- [ ] `src/components/workflow/nodes/TextNode/__tests__/behavior.test.ts`
  - 测试文本 asset 处理
  - 测试模板变量

### Queue Node
- [ ] `src/components/workflow/nodes/QueueNode/__tests__/behavior.test.ts`
  - 测试任务队列管理
  - 测试并发控制
  - 测试重试逻辑

### Selector Node
- [ ] `src/components/workflow/nodes/SelectorNode/__tests__/behavior.test.ts`
  - 测试选择逻辑
  - 测试过滤条件

### Gallery Node
- [ ] `src/components/workflow/nodes/GalleryNode/__tests__/behavior.test.ts`
  - 测试图片列表处理
  - 测试排序和过滤

### Table Node
- [ ] `src/components/workflow/nodes/TableNode/__tests__/behavior.test.ts`
  - 测试表格数据处理
  - 测试行列操作

---

## Phase 6: Hooks (Priority: Medium)

需要 mock React 和 Zustand。

### useRunRecipe
- [ ] `src/hooks/__tests__/useRunRecipe.test.ts`
  - 测试执行流程
  - 测试状态更新
  - 测试取消功能
  - 测试错误处理

### useNode
- [ ] `src/hooks/__tests__/useNode.test.ts` (已存在，检查覆盖)
  - 确保现有测试覆盖完整
  - 补充缺失的测试用例

### useAsset
- [ ] `src/hooks/__tests__/useAsset.test.ts`
  - 测试 asset 获取
  - 测试 asset 更新

### useFieldConnections
- [ ] `src/hooks/__tests__/useFieldConnections.test.ts`
  - 测试连接查找
  - 测试值传递

---

## Phase 7: Utilities (Priority: Medium)

工具函数测试。

### Canvas Utils
- [ ] `src/core/utils/__tests__/canvas.test.ts`
  - 测试坐标计算
  - 测试节点定位

### Graph Utils
- [ ] `src/core/utils/__tests__/graph.test.ts`
  - 测试图遍历
  - 测试依赖计算

### Image Utils
- [ ] `src/lib/utils/__tests__/image.test.ts`
  - 测试图片处理函数
  - 测试格式转换

### API Client
- [ ] `src/lib/__tests__/apiClient.test.ts`
  - 测试请求构建
  - 测试响应处理
  - 测试错误处理

---

## Phase 8: Widget Registry (Priority: Medium)

Widget 系统测试。

### Widget Registry
- [ ] `src/components/workflow/widgets/lib/__tests__/registry.test.ts` (已存在，检查覆盖)
  - 确保现有测试覆盖完整

### Field Row
- [ ] `src/components/workflow/widgets/lib/__tests__/FieldRow.test.tsx`
  - 测试字段渲染
  - 测试值变更回调

---

## Phase 9: Stores (Priority: Low)

Zustand store 测试。

### Workflow Store
- [ ] `src/store/__tests__/workflowStore.test.ts`
  - 测试节点 CRUD
  - 测试连接 CRUD
  - 测试状态更新

### Recipe Store
- [ ] `src/store/__tests__/recipeStore.test.ts`
  - 测试 recipe 加载
  - 测试 recipe 缓存

---

## Phase 10: Logic-Heavy Components (Priority: Low)

逻辑密集的组件测试。

### Inspector Panel
- [ ] `src/components/workflow/__tests__/InspectorPanel.test.tsx`
  - 测试节点选择时的渲染
  - 测试 Inspector 切换

### Form Renderer
- [ ] `src/components/workflow/inspector/__tests__/FormRenderer.test.tsx`
  - 测试表单生成
  - 测试值绑定

### Node Picker
- [x] `src/components/workflow/__tests__/NodePicker.test.tsx`
  - 测试节点搜索
  - 测试节点分类

---

## Success Criteria

1. `pnpm vitest run` 所有测试通过
2. `pnpm vitest run --coverage` 达到 60% line coverage
3. `pnpm lint` 无错误
4. `pnpm tsc --noEmit` 无错误

---

## Notes

- 跳过 `src/components/ui/` 目录（shadcn 组件，不需要测试）
- 跳过纯类型文件（`*.d.ts`, 只有 type/interface 的文件）
- 跳过 `src/main.tsx`（入口文件）
- 跳过 `src/locales/`（i18n 翻译文件）
- Model provider 实现（anthropic, openai 等）mock 掉，不测试真实 API
