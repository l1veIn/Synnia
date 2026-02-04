# Phase 4.5 实施清单（兼容层清理）

## 目标
- 收敛 legacy 兼容层
- 减少 assets/assetId 依赖

## 实施步骤
1. 依赖扫描
- 全局搜索 assets/AssetSystem/assetId
- 生成替换矩阵

2. assets store 角色调整
- 从“主数据源”降级为“投影/缓存”
- 保持 UI 兼容

3. 替换 assetId
- Node.id 作为主键
- 文件类使用 fileIds

4. 回归验证
- 节点创建/运行/连接
- 文件导入/展示

## 风险控制点
- UI 仍旧依赖 asset.value
- 旧数据迁移
