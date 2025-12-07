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

  // --- Architecture V2: Container Strategy ---
  // Replaces hardcoded Group logic. Defines how this node manages its children.
  layoutMode?: 'free' | 'rack' | 'list' | 'grid';

  // --- Legacy / Transitional Fields ---
  // These will be migrated to the Asset Store eventually.
  /** @deprecated Use assetId and Assets Store */
  assetType?: 'image' | 'text' | 'json'; 
  /** @deprecated Use assetId and Assets Store */
  content?: string; 
  /** @deprecated Use assetId and Assets Store */
  preview?: string; 
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

export type NodeStatus = NodeExecutionState;

export interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    type: 'system' | 'user';
    inputSchema?: any;
    outputSchema?: any;
    execute?: (context: any) => Promise<any>;
}

export type AssetData = any;

// --- Node Types Registry ---

/**
 * 节点类型枚举
 * 用于映射 React Flow 的 nodeTypes
 */
export enum NodeType {
  ASSET = 'asset-node',
  GROUP = 'group-node',
  RACK = 'rack-node',
  RECIPE = 'recipe-node',
  NOTE = 'note-node',
  COLLECTION = 'collection-node',
}

// --- Specific Node Data Interfaces (Optional but recommended for TS) ---

export interface AssetNodeData extends BaseNodeData {
  // Overriding/Refining BaseNodeData for Asset Nodes
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