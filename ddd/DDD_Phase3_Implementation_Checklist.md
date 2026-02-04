# Phase 3 实施清单（File 模型迁移）

## 目标
- File Aggregate 落地
- importHeavyNode 拆分
- Node.fileIds 替代旧的 asset.value.src

## 实施步骤
1. 领域模型
- 新增 `src/domain/file/File.ts`
- 新增 `src/domain/file/FileMetadata.ts`
- 新增 `src/domain/file/FileVariants.ts`
- 新增 `src/domain/file/FileIngestionPolicy.ts`（可选）

2. 领域服务与端口
- 新增 `src/domain/file/FileIngestionService.ts`（接口）
- 在 `src/application/ports/services.ts` 中定义 Ingestion Port

3. 基础设施适配
- 新增 `src/infrastructure/tauri/TauriFileAdapter.ts`
- 封装 import_resource 调用

4. 应用层用例
- 新增 `src/application/use-cases/import-file/`
- UseCase：调用 FileIngestionService + CreateNodeUseCase

5. Node 引用替换
- Node 中新增 `fileIds?: string[]`
- UI/Inspector/Widget 改为通过 fileIds 获取 File
- 旧字段保留为兼容投影（过渡期）

6. 回归验证
- 导入图片/视频
- Gallery 节点多文件
- 切换项目后文件引用仍正确

## 风险控制点
- 旧资产路径与新 fileIds 双轨混用
- 缩略图生成失败导致 UI 空白
- 文件元信息缺失导致布局异常
