/**
 * 视觉化资产操作系统 (Visual Asset OS) - 前端类型定义
 * 基于 universal_asset_registry.json 构建
 */

// 1. 资产类型枚举 (对应 Registry 中的 types key)
// 使用 Union 类型提供智能提示，同时允许 string 以支持动态扩展
export type AssetType = 
  | 'base_asset'
  | 'image_asset' 
  | 'video_asset'
  | 'document_asset'
  | 'text_asset' 
  | 'prompt_asset' 
  | 'collection_asset' 
  | 'generation_context' 
  | 'struct_asset'
  | 'character'
  | string; // 允许插件扩展，如 "flying_sword"

// 2. 资产状态 (对应 UI 边框颜色/加载条)
export type AssetStatus = 
  | 'idle'        // 正常 (默认灰色/蓝色边框)
  | 'processing'  // 处理中 (显示进度条)
  | 'success'     // 完成 (绿色闪烁或正常)
  | 'error'       // 错误 (红色边框，Rules 校验失败或 Agent 报错)
  | 'stale';      // 过时 (黄色边框，上游依赖已变更)

// 3. 核心数据接口：这是 ReactFlow Node.data 的结构
export interface AssetData {
  // --- 基础元数据 ---
  id: string;               // 节点唯一 ID (UUID)
  label?: string;           // UI 显示标题 (通常映射自 properties.name)
  assetType: AssetType;     // 资产类型
  category?: string;        // UI 分类，如 "Media", "World"
  
  // --- 核心内容 (对应 Registry 中的 properties + mixins) ---
  // 这里的 key 对应 registry 中的 properties key (如 src, content, age)
  properties: AssetProperties;

  // --- 状态控制 ---
  status: AssetStatus;
  progress?: number;        // 0-100, 仅当 status='processing' 时有效
  validationErrors?: string[]; // 具体的校验错误信息

  // --- 版本与血统 (Version Control) ---
  version: number;          // 当前版本号，每次 Remake +1
  provenance?: AssetProvenance; // 如果是配方产物，必须包含此字段
}

// 4. 动态属性包 (KV 存储)
export interface AssetProperties {
  // 基础属性 (来自 base_asset)
  name: string;             // 必填
  description?: string;
  tags?: string[];
  
  // 媒体属性 (来自 file_source mixin)
  src?: string;             // 本地路径或 URL
  mime_type?: string;
  size?: string;            // Computed string
  
  // 集合属性 (来自 collection_asset)
  members?: string[];       // 存储子节点的 ID 列表 (虚线引用)
  max_size?: number;

  // 创意属性 (来自 text_asset / prompt_asset)
  content?: string;         // 文本内容
  negative_prompt?: string;
  
  // 任意扩展字段 (由 struct_asset 或自定义 mixin 引入)
  [key: string]: any; 
}

// 5. 血统证明 (用于追踪配方来源和 Stale 判定)
export interface AssetProvenance {
  recipe_id: string;        // 使用了哪个配方 (如 "ai_txt2img")
  generated_at: number;     // 时间戳
  
  // 记录输入源的快照，用于对比版本
  sources: {
    node_id: string;        // 输入节点的 ID
    node_version: number;   // 当时使用的版本号
    slot?: string;          // 连入的插槽名称 (对于多输入配方)
  }[];

  // 当时使用的参数快照
  params_snapshot: Record<string, any>;
}

/**
 * 示例：一个生成的图片节点的 Data 对象
 */
/*
const exampleNodeData: AssetData = {
  id: "node_gen_001",
  label: "Cyberpunk City v2",
  assetType: "image_asset",
  category: "media",
  status: "ready",
  version: 2,
  properties: {
    name: "Cyberpunk City.png",
    src: "file:///local/assets/img_123.png",
    resolution: "1024x1024",
    size: "2.4MB"
  },
  provenance: {
    recipe_id: "ai_txt2img",
    generated_at: 1699999999,
    sources: [
      { node_id: "context_node_1", node_version: 5 }
    ],
    params_snapshot: { seed: 42, steps: 20 }
  }
}
*/