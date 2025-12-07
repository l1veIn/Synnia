import { NodeType } from '@/types/project';
import { 
  FileText, 
  Image as ImageIcon, 
  Play, 
  StickyNote, 
  Layers, 
  Box,
  LucideIcon
} from 'lucide-react';

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

export const nodesConfig: Record<NodeType, NodeConfig> = {
  [NodeType.ASSET]: {
    type: NodeType.ASSET,
    title: 'Text',
    category: 'Asset',
    icon: FileText, 
    description: 'Text block',
  },
  [NodeType.RECIPE]: {
    type: NodeType.RECIPE,
    title: 'Recipe',
    category: 'Process',
    icon: Play,
    description: 'Processing unit',
  },
  [NodeType.NOTE]: {
    type: NodeType.NOTE,
    title: 'Note',
    category: 'Utility',
    icon: StickyNote,
    description: 'Annotation',
    hidden: true,
  },
  [NodeType.GROUP]: {
    type: NodeType.GROUP,
    title: 'Group',
    category: 'Container',
    icon: Box,
    description: 'A collapsible group container',
    defaultWidth: 400,
    defaultHeight: 300,
    hidden: true,
  },
  [NodeType.RACK]: {
    type: NodeType.RACK,
    title: 'Rack',
    category: 'Container',
    icon: Layers,
    description: 'Linear container for assets',
    defaultWidth: 300,
    defaultHeight: 400,
  },
  [NodeType.COLLECTION]: {
    type: NodeType.COLLECTION,
    title: 'Collection',
    category: 'Container',
    icon: Layers,
    hidden: true,
  },
};