import { NodeType } from '@/types/project';
import { 
  FileText, 
  Image as ImageIcon, 
  Play, 
  StickyNote, 
  Layers, 
  Box,
  LucideIcon,
  FileJson
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
    title: 'Asset',
    category: 'Asset',
    icon: FileText, 
    description: 'Generic Asset',
  },
  [NodeType.TEXT]: {
    type: NodeType.TEXT,
    title: 'Text',
    category: 'Asset',
    icon: FileText, 
    description: 'Text content',
  },
  [NodeType.IMAGE]: {
    type: NodeType.IMAGE,
    title: 'Image',
    category: 'Asset',
    icon: ImageIcon, 
    description: 'Image content',
  },
  [NodeType.JSON]: {
    type: NodeType.JSON,
    title: 'JSON',
    category: 'Asset',
    icon: FileJson, 
    description: 'JSON content',
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