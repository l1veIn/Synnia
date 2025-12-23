import { Node, Edge, XYPosition } from '@xyflow/react';

// --- Core React Flow Extensions ---

/**
 * 核心节点状态，控制 UI 反馈
 */
export type NodeExecutionState = 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale';

/**
 * 基础节点数据接口
 * 所有 Synnia 节点都必须继承此接口
 */
export interface BaseNodeData extends Record<string, unknown> {
  // 基础 UI 属性
  title?: string;
  icon?: string; // Lucide icon name
  label?: string;

  // 状态属性
  state?: NodeExecutionState;
  errorMessage?: string;

  // UI State
  collapsed?: boolean;
  expandedWidth?: number;
  expandedHeight?: number;
  handlePosition?: 'top-bottom' | 'left-right';
  originalPosition?: XYPosition;

  // --- Architecture V2: Data Linkage ---
  // The 'assetId' connects this View Node to the Data Store.
  assetId?: string;

  // Is this a read-only shortcut?
  isReference?: boolean;

  // If this is a shortcut, where does it point to in the Graph? (Optional, for jumping)
  originalNodeId?: string;

  // --- New Feature: Docking ---
  // The ID of the node this node is docked to (Master)
  dockedTo?: string;

  // --- Architecture V2: Container Strategy ---
  // Replaces hardcoded Group logic. Defines how this node manages its children.
  layoutMode?: 'free' | 'rack' | 'list' | 'grid';

  // --- Recipe Node ---
  // The Recipe Definition ID for Recipe nodes
  recipeId?: string;

  // --- Output Edge: Product Relationship ---
  // True if this node is a product of a recipe (has incoming Output Edge)
  hasProductHandle?: boolean;

  // --- Legacy / Transitional Fields ---
  // These will be migrated to the Asset Store eventually.
  /** @deprecated Use assetId and Assets Store */
  assetType?: 'image' | 'text' | 'json';
  /** @deprecated Use assetId and Assets Store */
  content?: any; // string or FormAssetContent
  /** @deprecated Use assetId and Assets Store */
  preview?: string;
}

// --- Node-Specific Data Interfaces ---
// Display/UI config belongs to NodeData, not Asset

export interface GalleryNodeData extends BaseNodeData {
  viewMode?: 'grid' | 'list' | 'single';
  columnsPerRow?: number;
  allowStar?: boolean;
  allowDelete?: boolean;
}

export interface TableNodeData extends BaseNodeData {
  showRowNumbers?: boolean;
  allowAddRow?: boolean;
  allowDeleteRow?: boolean;
}

export interface QueueNodeData extends BaseNodeData {
  concurrency?: number;
  autoStart?: boolean;
  retryOnError?: boolean;
  retryCount?: number;
}

export interface SelectorNodeData extends BaseNodeData {
  optionSchema?: any[]; // FieldDefinition[]
  selected?: string[];
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
 * Edge Type for Output Edge (虚线产出连线)
 */
export type EdgeType = 'data' | 'output';

/**
 * Synnia 连线类型定义
 */
export type SynniaEdge = Edge<{ edgeType?: EdgeType }>;

export type NodeStatus = NodeExecutionState;

export type AssetData = any;

// --- Node Types Registry ---

/**
 * 节点类型枚举
 * 用于映射 React Flow 的 nodeTypes
 */
export enum NodeType {
  TEXT = 'text-node',
  IMAGE = 'image-node',
  FORM = 'form-node',
  RECIPE = 'recipe-node',
  SELECTOR = 'selector-node',
  GALLERY = 'gallery-node',
  TABLE = 'table-node',
  QUEUE = 'queue-node',
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
