import { Node } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';

// Helper: 检测 node 是否在 group 内部
export const isNodeInsideGroup = (node: Node, group: Node) => {
  if (!node.measured || !group.measured) return false;
  
  const nodeX = node.position.x;
  const nodeY = node.position.y;
  const nodeW = node.measured.width || 0;
  const nodeH = node.measured.height || 0;

  const groupX = group.position.x;
  const groupY = group.position.y;
  const groupW = group.measured.width || 0;
  const groupH = group.measured.height || 0;

  const centerX = nodeX + nodeW / 2;
  const centerY = nodeY + nodeH / 2;

  return (
    centerX > groupX &&
    centerX < groupX + groupW &&
    centerY > groupY &&
    centerY < groupY + groupH
  );
};

// Helper: 拓扑排序，确保 Parent 在 Child 前面
export const sortNodesTopologically = (nodes: SynniaNode[]): SynniaNode[] => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  nodes.forEach(node => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      roots.push(node.id);
    } else {
      const existing = childrenMap.get(node.parentId) || [];
      existing.push(node.id);
      childrenMap.set(node.parentId, existing);
    }
  });

  // 根节点排序：Group 优先
  roots.sort((a, b) => {
    const nodeA = nodeMap.get(a)!;
    const nodeB = nodeMap.get(b)!;
    if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
    if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
    return 0;
  });

  const result: SynniaNode[] = [];
  const queue = [...roots];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) {
      result.push(node);
      const children = childrenMap.get(id);
      if (children) {
        // 子节点排序：Group 优先
        children.sort((a, b) => {
          const nodeA = nodeMap.get(a)!;
          const nodeB = nodeMap.get(b)!;
          if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
          if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
          return 0;
        });
        
        children.forEach(childId => queue.push(childId));
      }
    }
  }

  return result;
};

// Helper: 递归获取所有子孙节点
export const getDescendants = (nodes: SynniaNode[], parentId: string): SynniaNode[] => {
    let descendants: SynniaNode[] = [];
    const children = nodes.filter(n => n.parentId === parentId);
    descendants.push(...children);
    children.forEach(child => {
        descendants.push(...getDescendants(nodes, child.id));
    });
    return descendants;
};
