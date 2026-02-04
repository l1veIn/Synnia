# Phase 3 提示词（File 模型迁移）

## 总体目标
- 引入 File Aggregate（独立实体）
- 建立 File Ingestion Pipeline（预处理、缩略图、元信息）
- Node 仅存 fileIds 引用

## 已完成内容（Phase 0-2）
- Phase 0: DDD 目录骨架已建立
- Phase 1: ValueMappingService 迁移完成
- Phase 2: Node=Asset 领域模型落地，Use Case 引入

## Phase 3 目标
- File 聚合模型落地（image/video）
- importHeavyNode 拆分为 Domain + Infra + Application
- Node.fileIds 替换 Asset 内隐文件字段

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_Phase2_Model.md](ddd/DDD_Phase2_Model.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：File 领域模型定义
你是领域建模工程师。
任务：创建 File 聚合模型。
要求：
- 新增 `src/domain/file/File.ts`
- 新增 `FileMetadata.ts`、`FileVariants.ts`
- 字段涵盖 mediaType/mimeType/source/storage/variants/metadata
输出：字段表 + 风险点

## 任务 B：File Ingestion Service
你是领域服务工程师。
任务：定义 FileIngestionService 接口（Domain）。
要求：
- 输入 source（路径/base64/URL）
- 输出 fileId + metadata + variants
- 强制生成 thumbnail（image/video）
输出：接口设计 + 预处理步骤

## 任务 C：Tauri Adapter 拆分
你是基础设施工程师。
任务：将 importHeavyNode 拆分为 Domain + Infra + App。
要求：
- Domain：FileIngestionPolicy / FileIngestionService
- Infra：TauriFileAdapter 调用 import_resource
- App：ImportFileUseCase 调度 Node 创建
输出：拆分方案 + 变更文件清单

## 任务 D：Node.fileIds 引用替换
你是迁移工程师。
任务：将 Node 的重资源引用统一为 fileIds。
要求：
- 更新使用 `asset.value.src` 的路径
- Graph/Inspector/UI 层改为 fileIds
输出：替换清单 + 兼容策略
