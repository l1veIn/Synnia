import { LucideIcon } from 'lucide-react';
import { NodeType, SynniaNode, BaseNodeData } from './project';
import { Asset } from './assets';
import { NodeCreationConfig } from './recipe';
import { XYPosition } from '@xyflow/react';

export type NodeCategory = 'Asset' | 'Process' | 'Utility' | 'Container' | 'Math' | 'Text' | 'HTTP' | 'Recipe';

/**
 * Data payload structure for node data flow
 */
export interface DataPayload {
  type: 'text' | 'image' | 'json' | 'array' | 'unknown';
  value: any;
  metadata?: any;
}

/**
 * Output resolver function type
 * Takes the node and its asset, returns a DataPayload
 */
export type OutputResolver = (node: SynniaNode, asset: Asset | undefined) => DataPayload | null;

/**
 * Output configuration for a node
 * Maps handleId to resolver function
 */
export type NodeOutputConfig = Record<string, OutputResolver>;

/**
 * File import configuration for nodes that require file selection
 * (e.g., Image, PDF, Video, Audio nodes)
 */
export interface FileImportConfig {
  /** Accept pattern for file input (e.g., 'image/*', 'application/pdf') */
  accept: string;
  /** Label shown in NodePicker */
  label?: string;
  /** Asset type to create (e.g., 'image', 'video') */
  assetType: 'image' | 'video' | 'audio' | 'pdf' | 'file';
}

/**
 * Node specification for creating nodes from executor results
 */
export interface NodeSpec {
  type: NodeType | string;
  data: Partial<BaseNodeData> & { content?: any };
  position?: 'below' | 'right' | XYPosition;
  dockedTo?: string | '$prev';
}

/**
 * Node configuration interface
 * 
 * Design Principle: Node-specific logic lives HERE, not in the engine.
 * The engine calls these factories - it never hardcodes node type logic.
 */
export interface NodeConfig {
  type: NodeType | string;
  title: string;
  category: NodeCategory;
  icon: LucideIcon;
  description?: string;
  hidden?: boolean;

  /** Default data to set when creating this node */
  defaultData?: Partial<BaseNodeData>;

  /** If set, this node requires file import */
  fileImport?: FileImportConfig;

  // ============================================================================
  // Self-Declaration Fields - Engine never hardcodes node type lists
  // ============================================================================

  /** If true, this node type requires an asset to be created with it */
  requiresAsset?: boolean;

  /** Default asset type for this node (text, image, json) */
  defaultAssetType?: 'text' | 'image' | 'json';

  /** Alias used in YAML nodeConfig.type (e.g., 'selector', 'table', 'gallery') */
  createNodeAlias?: string;

  // ============================================================================
  // Factory Methods - Node-specific logic (Engine never hardcodes these)
  // ============================================================================

  /** Default style (width/height) for this node type */
  defaultStyle?: { width?: number; height?: number };

  /** Factory: create default content for this node type's asset */
  createDefaultContent?: () => any;
}

