import { Node, Edge, XYPosition } from '@xyflow/react';

// --- Core React Flow Extensions ---

/**
 * 核心节点状态，控制 UI 反馈
 */
export type NodeExecutionState = 'idle' | 'running' | 'paused' | 'error' | 'success';

/**
 * 基础节点数据接口
 * 所有 Synnia 节点都必须继承此接口
 */
export interface BaseNodeData extends Record<string, unknown> {
  // 基础 UI 属性
  title: string;
  icon?: string; // Lucide icon name
  label?: string;
  
  // 状态属性
  state?: NodeExecutionState;
  errorMessage?: string;

  // 业务属性 (动态，不强制 schema)
  // 例如：text, imageUrl, value, prompt, ...
}

/**
 * Synnia 节点类型定义
 * 泛型 T 允许定义特定的 Data 类型，默认为 BaseNodeData
 */
export type SynniaNode<T extends BaseNodeData = BaseNodeData> = Node<T, string> & {
  // 可以在这里扩展 React Flow Node 的根属性，如果需要的话
  // 例如：parentId 对于 Group Node 是必须的
};

/**
 * Synnia 连线类型定义
 */
export type SynniaEdge = Edge;

// --- Node Types Registry ---

/**
 * 节点类型枚举
 * 用于映射 React Flow 的 nodeTypes
 */
export enum NodeType {
  // 基础类型
  ASSET = 'asset-node',       // 通用资产节点 (图片, 文本, 等)
  RECIPE = 'recipe-node',     // 处理节点 (API 调用, 转换等)
  NOTE = 'note-node',         // 纯注释/便签
  
  // 集合/容器类型
  GROUP = 'group-node',       // 基础分组
  COLLECTION = 'collection-node' // 带有特定业务逻辑的集合
}

// --- Specific Node Data Interfaces (Optional but recommended for TS) ---

export interface AssetNodeData extends BaseNodeData {
  assetType: 'image' | 'text' | 'json'; // 简单的类型标识
  content: string; // url or text content
  preview?: string; // optional preview url
}

export interface RecipeNodeData extends BaseNodeData {
  recipeId: string;
  params: Record<string, any>;
}

// --- Project State ---

export interface ProjectState {
  nodes: SynniaNode[];
  edges: SynniaEdge[];
  viewport: { x: number; y: number; zoom: number };
}
