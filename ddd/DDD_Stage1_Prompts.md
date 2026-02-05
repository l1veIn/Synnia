# 阶段 1 提示词（UI 路径归位）

## 目标
- 迁移 UI 到 `presentation/`

## 任务 A：components 迁移
你是迁移工程师。
任务：`src/components` → `src/presentation/components`
要求：
- 更新所有引用路径
- 保持 UI 正常
输出：改动文件清单

## 任务 B：pages 迁移
你是迁移工程师。
任务：`src/pages` → `src/presentation/pages`
要求：
- 更新路由引用
- 保持页面渲染
输出：改动清单

## 任务 C：hooks 迁移
你是迁移工程师。
任务：`src/hooks` → `src/presentation/hooks`
要求：
- 更新引用
- 不引入业务逻辑
输出：改动清单
