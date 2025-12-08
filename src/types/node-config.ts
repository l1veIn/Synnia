import { LucideIcon } from 'lucide-react';
import { NodeType } from './project';

export type NodeCategory = 'Asset' | 'Process' | 'Utility' | 'Container';

export interface NodeConfig {
  type: NodeType;
  title: string;
  category: NodeCategory;
  icon: LucideIcon;
  description?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  hidden?: boolean;
}
