import { LucideIcon } from 'lucide-react';
import { NodeType, SynniaNode, BaseNodeData } from './project';
import { Asset } from './assets';

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
 * Node configuration interface
 */
export interface NodeConfig {
  type: NodeType | string;  // Allow string for virtual recipe types
  title: string;
  category: NodeCategory;
  icon: LucideIcon;
  description?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  hidden?: boolean;
  /** Default data to set when creating this node */
  defaultData?: Partial<BaseNodeData>;
}
