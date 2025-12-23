import { NodeType, SynniaNode, BaseNodeData } from './project';
import { Asset } from './assets';
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
 */
export interface FileImportConfig {
  /** Accept pattern for file input (e.g., 'image/*', 'application/pdf') */
  accept: string;
  /** Label shown in NodePicker */
  label?: string;
  /** Asset type to create */
  assetType: 'image' | 'video' | 'audio' | 'pdf' | 'file';
}

/**
 * Node specification for creating nodes from executor results
 * @deprecated Use NodeSpec from NodeRegistry instead
 */
export interface NodeSpec {
  type: NodeType | string;
  data: Partial<BaseNodeData> & { content?: any };
  position?: 'below' | 'right' | XYPosition;
  dockedTo?: string | '$prev';
}

