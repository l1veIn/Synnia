/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   🎯 Synnia Project Types                       │
 * │              React Flow Extensions & Node Registry              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  SynniaNode = Node<BaseNodeData>  (React Flow extension)        │
 * │  SynniaEdge = Edge<EdgeData>      (React Flow extension)        │
 * │                                                                 │
 * │  BaseNodeData                                                   │
 * │  ├── title, icon, label          // UI properties               │
 * │  ├── state, errorMessage         // Execution state             │
 * │  ├── collapsed                   // UI state                    │
 * │  ├── assetId                     // Link to Asset Store         │
 * │  └── dockedTo, layoutMode        // Container/Docking           │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { Node, Edge, XYPosition } from '@xyflow/react';

// ==========================================
// 🎯 Core Types
// ==========================================

/**
 * Node execution state for UI feedback
 */
export type NodeExecutionState = 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale';

/**
 * Edge type: data flow or output relationship
 */
export type EdgeType = 'data' | 'output';

/**
 * Node type enum - maps to React Flow nodeTypes
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

// ==========================================
// 📋 Base Node Data
// ==========================================

/**
 * Base node data interface - all Synnia nodes inherit this
 */
export interface BaseNodeData extends Record<string, unknown> {
  // --- UI Properties ---
  title?: string;
  icon?: string;
  label?: string;

  // --- Execution State ---
  state?: NodeExecutionState;
  errorMessage?: string;

  // --- UI State ---
  collapsed?: boolean;
  expandedWidth?: number;
  expandedHeight?: number;
  originalPosition?: XYPosition;

  // --- Asset Linkage ---
  assetId?: string;
  isReference?: boolean;
  originalNodeId?: string;

  // --- Docking & Layout ---
  dockedTo?: string;
  layoutMode?: 'free' | 'rack' | 'list' | 'grid';

  // --- Product Relationship ---
  hasProductHandle?: boolean;
}

// ==========================================
// 🔗 React Flow Extensions
// ==========================================

/**
 * Synnia node type - extends React Flow Node
 */
export type SynniaNode<T extends BaseNodeData = BaseNodeData> = Node<T, string>;

/**
 * Synnia edge type - extends React Flow Edge
 */
export type SynniaEdge = Edge<{ edgeType?: EdgeType }>;

// ==========================================
// 📦 Project State
// ==========================================

/**
 * Complete project state for persistence
 */
export interface ProjectState {
  nodes: SynniaNode[];
  edges: SynniaEdge[];
  viewport: { x: number; y: number; zoom: number };
}
